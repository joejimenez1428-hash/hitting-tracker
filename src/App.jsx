import React, { useState, useEffect, useMemo } from 'react';
import { Plus, User, TrendingUp, ChevronRight, RotateCcw, Save, ArrowLeft, Trash2, Wifi, WifiOff, RefreshCw, Settings, X, Users, Play, Check, Filter, Calendar, TrendingDown, Minus } from 'lucide-react';

// ===========================================
// CONFIGURATION
// ===========================================
const DEFAULT_CONFIG = {
  url: 'YOUR_SUPABASE_URL',
  key: 'YOUR_SUPABASE_ANON_KEY'
};

// Pitch type options
const PITCH_TYPES = [
  { value: 'righty_fb', label: 'Righty FB' },
  { value: 'lefty_fb', label: 'Lefty FB' },
  { value: 'righty_cb', label: 'Righty Slow CB' },
  { value: 'lefty_cb', label: 'Lefty Slow CB' }
];

const getPitchTypeLabel = (value) => {
  const pt = PITCH_TYPES.find(p => p.value === value);
  return pt ? pt.label : value;
};

// ===========================================
// Supabase Client
// ===========================================
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.updateHeaders();
  }

  updateHeaders() {
    this.headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  async query(table, method = 'GET', body = null, queryParams = '') {
    const options = { method, headers: this.headers };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(`${this.url}/rest/v1/${table}${queryParams}`, options);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase error: ${error}`);
    }
    
    if (method === 'DELETE') return null;
    return response.json();
  }

  async getPlayers() {
    return this.query('players', 'GET', null, '?order=name.asc');
  }

  async createPlayer(name) {
    return this.query('players', 'POST', { name });
  }

  async deletePlayer(id) {
    return this.query('players', 'DELETE', null, `?id=eq.${id}`);
  }

  async getSessions() {
    return this.query('sessions', 'GET', null, '?order=date.desc');
  }

  async createSession(pitchType) {
    return this.query('sessions', 'POST', { pitch_type: pitchType });
  }

  async getSessionPlayers() {
    return this.query('session_players', 'GET', null, '?order=created_at.asc');
  }

  async addSessionPlayer(sessionId, playerId) {
    return this.query('session_players', 'POST', { session_id: sessionId, player_id: playerId });
  }

  async getReps() {
    return this.query('reps', 'GET', null, '?order=created_at.asc');
  }

  async createReps(reps) {
    return this.query('reps', 'POST', reps);
  }
}

const supabase = new SupabaseClient(DEFAULT_CONFIG.url, DEFAULT_CONFIG.key);

// ===========================================
// Local Storage Helpers
// ===========================================
const OFFLINE_QUEUE_KEY = 'hitting_tracker_offline_queue';
const LOCAL_CACHE_KEY = 'hitting_tracker_cache';
const CONFIG_KEY = 'hitting_tracker_config';

const getOfflineQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch { return []; }
};

const addToOfflineQueue = (action) => {
  const queue = getOfflineQueue();
  queue.push({ ...action, timestamp: Date.now(), id: `offline_${Date.now()}_${Math.random()}` });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const clearOfflineQueue = () => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, '[]');
};

const getLocalCache = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
  } catch { return {}; }
};

const setLocalCache = (data) => {
  localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ ...data, lastUpdated: Date.now() }));
};

const getConfig = () => {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY)) || DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
};

const setConfig = (config) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  supabase.url = config.url;
  supabase.key = config.key;
  supabase.updateHeaders();
};

// ===========================================
// Helper Functions
// ===========================================
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateShort = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ===========================================
// Components
// ===========================================

// Strike Zone Component
const StrikeZone = ({ selected, onSelect, heatMapData = null }) => {
  const zones = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  
  const getZoneColor = (zone) => {
    if (!heatMapData) return null;
    const data = heatMapData[zone];
    if (!data || data.total === 0) return 'bg-gray-700';
    
    const rate = parseFloat(data.hardHitRate);
    if (rate >= 50) return 'bg-green-600';
    if (rate >= 35) return 'bg-yellow-600';
    if (rate >= 20) return 'bg-orange-600';
    return 'bg-red-600';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-3 gap-1 bg-gray-800 p-2 rounded-lg">
        {zones.flat().map((zone) => {
          const heatColor = getZoneColor(zone);
          return (
            <button
              key={zone}
              onClick={() => onSelect && onSelect(zone)}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded flex flex-col items-center justify-center text-sm font-medium transition-all active:scale-95
                ${selected === zone 
                  ? 'bg-blue-500 text-white ring-2 ring-blue-300' 
                  : heatColor || 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              <span>{zone}</span>
              {heatMapData && heatMapData[zone] && heatMapData[zone].total > 0 && (
                <span className="text-xs opacity-80">{heatMapData[zone].hardHitRate}%</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Toggle Button Group
const ToggleGroup = ({ label, options, selected, onSelect, columns = 2 }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-gray-300">{label}</label>
    <div className={`grid gap-2 grid-cols-${columns}`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={`px-3 py-3 rounded-lg text-sm font-medium transition-all active:scale-95
            ${selected === option.value
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

// Connection Status
const ConnectionStatus = ({ isOnline, pendingCount, onSync }) => (
  <div className="flex items-center gap-2">
    {pendingCount > 0 && (
      <button onClick={onSync} className="flex items-center gap-1 px-2 py-1 bg-yellow-600 rounded text-xs">
        <RefreshCw size={12} />
        {pendingCount} pending
      </button>
    )}
    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${isOnline ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'}`}>
      {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
      {isOnline ? 'Online' : 'Offline'}
    </div>
  </div>
);

// Settings Modal
const SettingsModal = ({ isOpen, onClose, onSave }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const config = getConfig();
      setUrl(config.url);
      setKey(config.key);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Supabase Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Supabase URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Anon Key</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJS..."
              className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm font-mono text-xs"
            />
          </div>
          <button
            onClick={() => { onSave(url, key); onClose(); }}
            className="w-full py-3 bg-blue-500 rounded-lg font-medium hover:bg-blue-600"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};

// Player Selection for Session
const PlayerSelector = ({ players, selectedIds, onToggle }) => (
  <div className="space-y-2">
    {players.map((player) => (
      <button
        key={player.id}
        onClick={() => onToggle(player.id)}
        className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all
          ${selectedIds.includes(player.id) ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
      >
        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center
          ${selectedIds.includes(player.id) ? 'border-white bg-white' : 'border-gray-500'}`}>
          {selectedIds.includes(player.id) && <Check size={16} className="text-blue-600" />}
        </div>
        <span>{player.name}</span>
      </button>
    ))}
  </div>
);

// Player Tabs during session
const PlayerTabs = ({ players, activeId, onSelect, repsCount }) => (
  <div className="flex gap-2 overflow-x-auto pb-2">
    {players.map((player) => (
      <button
        key={player.id}
        onClick={() => onSelect(player.id)}
        className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 transition-all
          ${activeId === player.id ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
      >
        <span>{player.name}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${activeId === player.id ? 'bg-blue-400' : 'bg-gray-600'}`}>
          {repsCount[player.id] || 0}
        </span>
      </button>
    ))}
  </div>
);

// Trend Indicator Component
const TrendIndicator = ({ current, previous, suffix = '%' }) => {
  if (previous === null || previous === undefined || isNaN(previous)) {
    return <span className="text-gray-500 text-xs">No prior data</span>;
  }
  
  const diff = current - previous;
  const diffRounded = Math.abs(diff).toFixed(1);
  
  if (Math.abs(diff) < 0.5) {
    return (
      <span className="text-gray-400 text-xs flex items-center gap-1">
        <Minus size={12} /> No change
      </span>
    );
  }
  
  if (diff > 0) {
    return (
      <span className="text-green-400 text-xs flex items-center gap-1">
        <TrendingUp size={12} /> +{diffRounded}{suffix}
      </span>
    );
  }
  
  return (
    <span className="text-red-400 text-xs flex items-center gap-1">
      <TrendingDown size={12} /> -{diffRounded}{suffix}
    </span>
  );
};

// Metric Card with Trends
const MetricCard = ({ label, value, vsLast5, vsLastMonth }) => (
  <div className="bg-gray-700 rounded-lg p-4">
    <p className="text-gray-400 text-sm mb-1">{label}</p>
    <p className="text-2xl font-bold mb-2">{value}%</p>
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">vs Last 5 Sessions:</span>
        <TrendIndicator current={parseFloat(value)} previous={vsLast5} />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">vs Last Month:</span>
        <TrendIndicator current={parseFloat(value)} previous={vsLastMonth} />
      </div>
    </div>
  </div>
);

// Analytics Filter Component
const AnalyticsFilter = ({ 
  filters, 
  setFilters, 
  pitchTypes, 
  sessions, 
  sessionPlayers, 
  selectedPlayerId,
  players 
}) => {
  const [showFilters, setShowFilters] = useState(false);
  
  // Get sessions for this player
  const playerSessions = useMemo(() => {
    if (!selectedPlayerId) return [];
    const playerSessionIds = sessionPlayers
      .filter(sp => sp.player_id === selectedPlayerId)
      .map(sp => sp.session_id);
    return sessions
      .filter(s => playerSessionIds.includes(s.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [selectedPlayerId, sessions, sessionPlayers]);

  const hasActiveFilters = filters.pitchType || filters.dateRange !== 'all' || filters.sessionId || filters.startDate || filters.endDate;
  
  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg text-sm"
      >
        <Filter size={16} />
        Filters
        {hasActiveFilters && (
          <span className="bg-blue-500 text-xs px-1.5 py-0.5 rounded">Active</span>
        )}
      </button>
      
      {showFilters && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          {/* Specific Session Filter */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Specific Session</label>
            <select
              value={filters.sessionId || ''}
              onChange={(e) => setFilters({ 
                ...filters, 
                sessionId: e.target.value || null,
                // Clear date filters when selecting a session
                dateRange: e.target.value ? 'all' : filters.dateRange,
                startDate: e.target.value ? null : filters.startDate,
                endDate: e.target.value ? null : filters.endDate
              })}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
            >
              <option value="">All Sessions</option>
              {playerSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {formatDate(session.date)} - {getPitchTypeLabel(session.pitch_type)}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Custom Date Range</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  startDate: e.target.value || null,
                  sessionId: null,
                  dateRange: 'custom'
                })}
                className="flex-1 px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
              />
              <span className="text-gray-500 self-center">to</span>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  endDate: e.target.value || null,
                  sessionId: null,
                  dateRange: 'custom'
                })}
                className="flex-1 px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
              />
            </div>
          </div>

          {/* Quick Date Range */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Quick Range</label>
            <select
              value={filters.sessionId ? '' : filters.dateRange}
              onChange={(e) => setFilters({ 
                ...filters, 
                dateRange: e.target.value,
                sessionId: null,
                startDate: null,
                endDate: null
              })}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>

          {/* Pitch Type Filter */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Pitch Type</label>
            <select
              value={filters.pitchType || ''}
              onChange={(e) => setFilters({ ...filters, pitchType: e.target.value || null })}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
            >
              <option value="">All Pitch Types</option>
              {pitchTypes.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setFilters({ pitchType: null, dateRange: 'all', sessionId: null, startDate: null, endDate: null })}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
};

// Session Recap Component
const SessionRecap = ({ session, sessionPlayers, reps, players, onClose }) => {
  const playerStats = useMemo(() => {
    return sessionPlayers.map((sp) => {
      const player = players.find(p => p.id === sp.player_id);
      const playerReps = reps.filter(r => r.player_id === sp.player_id && r.session_id === session.id);
      
      if (playerReps.length === 0) {
        return { player, reps: 0, hardHitRate: 0, contactRate: 0, lineDriveRate: 0, backspinRate: 0 };
      }
      
      const contactReps = playerReps.filter(r => r.launch_angle !== 'miss');
      
      return {
        player,
        reps: playerReps.length,
        hardHitRate: ((playerReps.filter(r => r.hard_hit === 'yes').length / playerReps.length) * 100).toFixed(0),
        contactRate: ((contactReps.length / playerReps.length) * 100).toFixed(0),
        lineDriveRate: contactReps.length > 0 
          ? ((contactReps.filter(r => r.launch_angle === 'line').length / contactReps.length) * 100).toFixed(0)
          : 0,
        backspinRate: contactReps.length > 0
          ? ((contactReps.filter(r => r.spin === 'back').length / contactReps.length) * 100).toFixed(0)
          : 0
      };
    });
  }, [session, sessionPlayers, reps, players]);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Session Recap</h2>
            <p className="text-gray-400 text-sm">{getPitchTypeLabel(session.pitch_type)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg">
            <X size={24} />
          </button>
        </div>
        
        <div className="grid gap-4">
          {playerStats.map(({ player, reps, hardHitRate, contactRate, lineDriveRate, backspinRate }) => (
            <div key={player?.id || 'unknown'} className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-medium mb-3">{player?.name || 'Unknown'}</h3>
              <div className="grid grid-cols-5 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold">{reps}</p>
                  <p className="text-xs text-gray-400">Reps</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{hardHitRate}%</p>
                  <p className="text-xs text-gray-400">Hard Hit</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-400">{contactRate}%</p>
                  <p className="text-xs text-gray-400">Contact</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-400">{lineDriveRate}%</p>
                  <p className="text-xs text-gray-400">Line Drive</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-400">{backspinRate}%</p>
                  <p className="text-xs text-gray-400">Backspin</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-blue-500 rounded-lg font-medium hover:bg-blue-600"
        >
          Done
        </button>
      </div>
    </div>
  );
};

// ===========================================
// Main App
// ===========================================
export default function HittingTrackerV2() {
  // Config & connection state
  const [config, setConfigState] = useState(getConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data state
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionPlayers, setSessionPlayers] = useState([]);
  const [reps, setReps] = useState([]);

  // UI state
  const [view, setView] = useState('home');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  // Session setup state
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [selectedPitchType, setSelectedPitchType] = useState(null);

  // Active session state
  const [currentSession, setCurrentSession] = useState(null);
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [sessionReps, setSessionReps] = useState([]);
  const [currentRep, setCurrentRep] = useState({
    pitchLocation: null,
    hardHit: null,
    launchAngle: null,
    direction: null,
    spin: null
  });

  // Analytics state
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [analyticsFilters, setAnalyticsFilters] = useState({ 
    pitchType: null, 
    dateRange: 'all', 
    sessionId: null,
    startDate: null,
    endDate: null
  });

  // Session recap state
  const [showRecap, setShowRecap] = useState(false);
  const [recapSession, setRecapSession] = useState(null);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending actions
  useEffect(() => {
    setPendingActions(getOfflineQueue());
  }, []);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [config]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      syncOfflineActions();
    }
  }, [isOnline]);

  const saveConfig = (url, key) => {
    const newConfig = { url, key };
    setConfig(newConfig);
    setConfigState(newConfig);
  };

  const loadData = async () => {
    if (config.url === 'YOUR_SUPABASE_URL') {
      setIsLoading(false);
      setShowSettings(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Load from cache first
    const cache = getLocalCache();
    if (cache.players) setPlayers(cache.players);
    if (cache.sessions) setSessions(cache.sessions);
    if (cache.sessionPlayers) setSessionPlayers(cache.sessionPlayers);
    if (cache.reps) setReps(cache.reps);

    if (!isOnline) {
      setIsLoading(false);
      return;
    }

    try {
      const [playersData, sessionsData, sessionPlayersData, repsData] = await Promise.all([
        supabase.getPlayers(),
        supabase.getSessions(),
        supabase.getSessionPlayers(),
        supabase.getReps()
      ]);

      setPlayers(playersData || []);
      setSessions(sessionsData || []);
      setSessionPlayers(sessionPlayersData || []);
      setReps(repsData || []);

      setLocalCache({
        players: playersData || [],
        sessions: sessionsData || [],
        sessionPlayers: sessionPlayersData || [],
        reps: repsData || []
      });
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to connect. Check your Supabase settings.');
    }
    
    setIsLoading(false);
  };

  const syncOfflineActions = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    for (const action of queue) {
      try {
        switch (action.type) {
          case 'CREATE_PLAYER':
            await supabase.createPlayer(action.data.name);
            break;
          case 'DELETE_PLAYER':
            await supabase.deletePlayer(action.data.id);
            break;
          case 'CREATE_SESSION':
            const [session] = await supabase.createSession(action.data.pitchType);
            if (session) {
              for (const playerId of action.data.playerIds) {
                await supabase.addSessionPlayer(session.id, playerId);
              }
              if (action.data.reps.length > 0) {
                const repsToCreate = action.data.reps.map(r => ({
                  session_id: session.id,
                  player_id: r.playerId,
                  rep_number: r.repNumber,
                  pitch_location: r.pitchLocation,
                  hard_hit: r.hardHit,
                  launch_angle: r.launchAngle,
                  direction: r.direction,
                  spin: r.spin,
                  pitch_type: action.data.pitchType
                }));
                await supabase.createReps(repsToCreate);
              }
            }
            break;
        }
      } catch (err) {
        console.error('Failed to sync action:', action, err);
        return;
      }
    }

    clearOfflineQueue();
    setPendingActions([]);
    await loadData();
  };

  // Player management
  const addPlayer = async () => {
    if (!newPlayerName.trim()) return;
    
    const tempId = `temp_${Date.now()}`;
    const newPlayer = { id: tempId, name: newPlayerName.trim(), created_at: new Date().toISOString() };
    
    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
    setShowAddPlayer(false);

    if (isOnline) {
      try {
        const [created] = await supabase.createPlayer(newPlayerName.trim());
        setPlayers(prev => prev.map(p => p.id === tempId ? created : p));
      } catch (err) {
        addToOfflineQueue({ type: 'CREATE_PLAYER', data: { name: newPlayerName.trim() } });
        setPendingActions(getOfflineQueue());
      }
    } else {
      addToOfflineQueue({ type: 'CREATE_PLAYER', data: { name: newPlayerName.trim() } });
      setPendingActions(getOfflineQueue());
    }
  };

  const deletePlayer = async (playerId) => {
    if (!confirm('Delete this player and all their data?')) return;

    setPlayers(players.filter(p => p.id !== playerId));

    if (isOnline && !playerId.startsWith('temp_')) {
      try {
        await supabase.deletePlayer(playerId);
      } catch (err) {
        addToOfflineQueue({ type: 'DELETE_PLAYER', data: { id: playerId } });
        setPendingActions(getOfflineQueue());
      }
    }
  };

  // Session management
  const togglePlayerSelection = (playerId) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const startSession = () => {
    if (selectedPlayerIds.length === 0 || !selectedPitchType) return;
    
    const tempSessionId = `temp_session_${Date.now()}`;
    setCurrentSession({ id: tempSessionId, pitch_type: selectedPitchType, date: new Date().toISOString() });
    setActivePlayerId(selectedPlayerIds[0]);
    setSessionReps([]);
    setView('session');
  };

  const resetCurrentRep = () => {
    setCurrentRep({
      pitchLocation: null,
      hardHit: null,
      launchAngle: null,
      direction: null,
      spin: null
    });
  };

  const isRepComplete = () => {
    return currentRep.pitchLocation !== null &&
           currentRep.hardHit !== null &&
           currentRep.launchAngle !== null &&
           currentRep.direction !== null &&
           currentRep.spin !== null;
  };

  const logRep = () => {
    if (!isRepComplete()) return;
    
    const newRep = {
      ...currentRep,
      playerId: activePlayerId,
      repNumber: sessionReps.filter(r => r.playerId === activePlayerId).length + 1
    };
    
    setSessionReps([...sessionReps, newRep]);
    resetCurrentRep();
  };

  const getPlayerRepCount = () => {
    const counts = {};
    selectedPlayerIds.forEach(id => {
      counts[id] = sessionReps.filter(r => r.playerId === id).length;
    });
    return counts;
  };

  const endSession = async () => {
    if (sessionReps.length === 0) {
      setView('home');
      resetSessionState();
      return;
    }

    const sessionData = {
      pitchType: selectedPitchType,
      playerIds: selectedPlayerIds,
      reps: sessionReps
    };

    const tempSession = {
      id: currentSession.id,
      pitch_type: selectedPitchType,
      date: new Date().toISOString()
    };

    const tempSessionPlayers = selectedPlayerIds.map(pid => ({
      id: `temp_sp_${Date.now()}_${pid}`,
      session_id: currentSession.id,
      player_id: pid
    }));

    const tempReps = sessionReps.map((r, i) => ({
      id: `temp_rep_${Date.now()}_${i}`,
      session_id: currentSession.id,
      player_id: r.playerId,
      rep_number: r.repNumber,
      pitch_location: r.pitchLocation,
      hard_hit: r.hardHit,
      launch_angle: r.launchAngle,
      direction: r.direction,
      spin: r.spin,
      pitch_type: selectedPitchType,
      created_at: new Date().toISOString()
    }));

    setSessions([tempSession, ...sessions]);
    setSessionPlayers([...sessionPlayers, ...tempSessionPlayers]);
    setReps([...reps, ...tempReps]);

    setRecapSession(tempSession);
    setShowRecap(true);
    setView('home');

    if (isOnline) {
      try {
        const [session] = await supabase.createSession(selectedPitchType);
        if (session) {
          for (const playerId of selectedPlayerIds) {
            await supabase.addSessionPlayer(session.id, playerId);
          }
          if (sessionReps.length > 0) {
            const repsToCreate = sessionReps.map(r => ({
              session_id: session.id,
              player_id: r.playerId,
              rep_number: r.repNumber,
              pitch_location: r.pitchLocation,
              hard_hit: r.hardHit,
              launch_angle: r.launchAngle,
              direction: r.direction,
              spin: r.spin,
              pitch_type: selectedPitchType
            }));
            await supabase.createReps(repsToCreate);
          }
          await loadData();
        }
      } catch (err) {
        console.error('Failed to save session:', err);
        addToOfflineQueue({ type: 'CREATE_SESSION', data: sessionData });
        setPendingActions(getOfflineQueue());
      }
    } else {
      addToOfflineQueue({ type: 'CREATE_SESSION', data: sessionData });
      setPendingActions(getOfflineQueue());
    }

    resetSessionState();
  };

  const resetSessionState = () => {
    setCurrentSession(null);
    setActivePlayerId(null);
    setSessionReps([]);
    setSelectedPlayerIds([]);
    setSelectedPitchType(null);
    resetCurrentRep();
  };

  // Analytics calculations
  const getFilteredReps = (playerId) => {
    let filtered = reps.filter(r => r.player_id === playerId);
    
    // Filter by specific session
    if (analyticsFilters.sessionId) {
      filtered = filtered.filter(r => r.session_id === analyticsFilters.sessionId);
      return filtered;
    }
    
    // Filter by pitch type
    if (analyticsFilters.pitchType) {
      filtered = filtered.filter(r => r.pitch_type === analyticsFilters.pitchType);
    }
    
    // Filter by custom date range
    if (analyticsFilters.startDate || analyticsFilters.endDate) {
      if (analyticsFilters.startDate) {
        const start = new Date(analyticsFilters.startDate);
        start.setHours(0, 0, 0, 0);
        filtered = filtered.filter(r => new Date(r.created_at) >= start);
      }
      if (analyticsFilters.endDate) {
        const end = new Date(analyticsFilters.endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(r => new Date(r.created_at) <= end);
      }
      return filtered;
    }
    
    // Filter by quick date range
    if (analyticsFilters.dateRange !== 'all' && analyticsFilters.dateRange !== 'custom') {
      const now = new Date();
      let cutoff;
      switch (analyticsFilters.dateRange) {
        case 'today':
          cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      if (cutoff) {
        filtered = filtered.filter(r => new Date(r.created_at) >= cutoff);
      }
    }
    
    return filtered;
  };

  // Get stats for a specific set of reps
  const calculateStats = (repsData) => {
    if (!repsData || repsData.length === 0) return null;
    
    const contactReps = repsData.filter(r => r.launch_angle !== 'miss');
    
    return {
      hardHitRate: (repsData.filter(r => r.hard_hit === 'yes').length / repsData.length) * 100,
      lineDriveRate: contactReps.length > 0 
        ? (contactReps.filter(r => r.launch_angle === 'line').length / contactReps.length) * 100
        : 0,
      backspinRate: contactReps.length > 0
        ? (contactReps.filter(r => r.spin === 'back').length / contactReps.length) * 100
        : 0
    };
  };

  // Get last 5 sessions stats for a player
  const getLast5SessionsStats = (playerId) => {
    const playerSessionIds = sessionPlayers
      .filter(sp => sp.player_id === playerId)
      .map(sp => sp.session_id);
    
    const playerSessions = sessions
      .filter(s => playerSessionIds.includes(s.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    
    if (playerSessions.length === 0) return null;
    
    const sessionRepsData = reps.filter(r => 
      r.player_id === playerId && 
      playerSessions.map(s => s.id).includes(r.session_id)
    );
    
    return calculateStats(sessionRepsData);
  };

  // Get last month stats for a player
  const getLastMonthStats = (playerId) => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const monthReps = reps.filter(r => 
      r.player_id === playerId && 
      new Date(r.created_at) >= oneMonthAgo
    );
    
    return calculateStats(monthReps);
  };

  const getPlayerStats = (playerId) => {
    const playerReps = getFilteredReps(playerId);
    if (playerReps.length === 0) return null;

    const contactReps = playerReps.filter(r => r.launch_angle !== 'miss');
    
    // Current filtered stats
    const currentStats = calculateStats(playerReps);
    
    // Comparison stats (only if not filtering by specific session)
    let last5Stats = null;
    let lastMonthStats = null;
    
    if (!analyticsFilters.sessionId) {
      last5Stats = getLast5SessionsStats(playerId);
      lastMonthStats = getLastMonthStats(playerId);
    }
    
    // Zone stats for heat map
    const zones = {};
    for (let i = 1; i <= 9; i++) {
      const zoneReps = playerReps.filter(r => r.pitch_location === i);
      zones[i] = {
        total: zoneReps.length,
        hardHitRate: zoneReps.length > 0 
          ? ((zoneReps.filter(r => r.hard_hit === 'yes').length / zoneReps.length) * 100).toFixed(0)
          : '0'
      };
    }

    return {
      totalReps: playerReps.length,
      hardHitRate: currentStats.hardHitRate.toFixed(1),
      lineDriveRate: currentStats.lineDriveRate.toFixed(1),
      backspinRate: currentStats.backspinRate.toFixed(1),
      contactRate: ((contactReps.length / playerReps.length) * 100).toFixed(1),
      // Comparison data
      last5: last5Stats ? {
        hardHitRate: last5Stats.hardHitRate,
        lineDriveRate: last5Stats.lineDriveRate,
        backspinRate: last5Stats.backspinRate
      } : null,
      lastMonth: lastMonthStats ? {
        hardHitRate: lastMonthStats.hardHitRate,
        lineDriveRate: lastMonthStats.lineDriveRate,
        backspinRate: lastMonthStats.backspinRate
      } : null,
      launchAngle: {
        flyBall: ((playerReps.filter(r => r.launch_angle === 'fly').length / playerReps.length) * 100).toFixed(1),
        lineDrive: ((playerReps.filter(r => r.launch_angle === 'line').length / playerReps.length) * 100).toFixed(1),
        groundBall: ((playerReps.filter(r => r.launch_angle === 'ground').length / playerReps.length) * 100).toFixed(1),
        miss: ((playerReps.filter(r => r.launch_angle === 'miss').length / playerReps.length) * 100).toFixed(1),
      },
      direction: {
        pull: contactReps.length > 0 ? ((contactReps.filter(r => r.direction === 'pull').length / contactReps.length) * 100).toFixed(1) : '0',
        middle: contactReps.length > 0 ? ((contactReps.filter(r => r.direction === 'middle').length / contactReps.length) * 100).toFixed(1) : '0',
        oppo: contactReps.length > 0 ? ((contactReps.filter(r => r.direction === 'oppo').length / contactReps.length) * 100).toFixed(1) : '0',
      },
      zones
    };
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Session Recap Modal
  const recapSessionPlayers = recapSession 
    ? sessionPlayers.filter(sp => sp.session_id === recapSession.id)
    : [];

  // ===========================================
  // VIEWS
  // ===========================================

  // HOME VIEW
  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">Hitting Tracker</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-800 rounded-lg">
                <Settings size={20} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <ConnectionStatus isOnline={isOnline} pendingCount={pendingActions.length} onSync={syncOfflineActions} />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-200">{error}</div>
          )}

          <div className="grid gap-4 mb-6">
            <button
              onClick={() => setView('setup')}
              disabled={players.length === 0}
              className={`p-6 rounded-xl flex items-center gap-4 transition-all
                ${players.length > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
            >
              <Play size={32} />
              <div className="text-left">
                <p className="text-lg font-semibold">Start Session</p>
                <p className="text-sm opacity-80">Select players and pitch type</p>
              </div>
            </button>

            <button
              onClick={() => setView('analytics')}
              className="p-6 bg-gray-800 rounded-xl flex items-center gap-4 hover:bg-gray-750 transition-all"
            >
              <TrendingUp size={32} />
              <div className="text-left">
                <p className="text-lg font-semibold">Analytics</p>
                <p className="text-sm text-gray-400">View player stats and trends</p>
              </div>
            </button>

            <button
              onClick={() => setView('players')}
              className="p-6 bg-gray-800 rounded-xl flex items-center gap-4 hover:bg-gray-750 transition-all"
            >
              <Users size={32} />
              <div className="text-left">
                <p className="text-lg font-semibold">Manage Players</p>
                <p className="text-sm text-gray-400">{players.length} players</p>
              </div>
            </button>
          </div>

          {sessions.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-300 mb-3">Recent Sessions</h2>
              <div className="space-y-2">
                {sessions.slice(0, 5).map((session) => {
                  const sp = sessionPlayers.filter(s => s.session_id === session.id);
                  const sessionPlayerNames = sp.map(s => players.find(p => p.id === s.player_id)?.name).filter(Boolean);
                  const sessionRepsCount = reps.filter(r => r.session_id === session.id).length;
                  
                  return (
                    <div key={session.id} className="bg-gray-800 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{getPitchTypeLabel(session.pitch_type)}</p>
                          <p className="text-sm text-gray-400">
                            {sessionPlayerNames.join(', ')} · {sessionRepsCount} reps
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatDateShort(session.date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={saveConfig}
        />

        {showRecap && recapSession && (
          <SessionRecap
            session={recapSession}
            sessionPlayers={recapSessionPlayers}
            reps={reps}
            players={players}
            onClose={() => { setShowRecap(false); setRecapSession(null); }}
          />
        )}
      </div>
    );
  }

  // PLAYERS VIEW
  if (view === 'players') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('home')} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold">Players</h1>
          </div>

          <div className="space-y-3 mb-6">
            {players.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">No players yet. Add your first player below.</p>
            ) : (
              players.map((player) => (
                <div key={player.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${player.id.toString().startsWith('temp_') ? 'bg-yellow-600' : 'bg-blue-600'}`}>
                      <User size={20} />
                    </div>
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <button
                    onClick={() => deletePlayer(player.id)}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>

          {showAddPlayer ? (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Player name"
                className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
              />
              <div className="flex gap-2">
                <button onClick={addPlayer} className="flex-1 py-3 bg-blue-500 rounded-lg font-medium hover:bg-blue-600">
                  Add Player
                </button>
                <button onClick={() => { setShowAddPlayer(false); setNewPlayerName(''); }} className="px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddPlayer(true)}
              className="w-full py-4 bg-gray-800 rounded-xl flex items-center justify-center gap-2 text-gray-300 hover:text-white border-2 border-dashed border-gray-700"
            >
              <Plus size={20} />
              Add Player
            </button>
          )}
        </div>
      </div>
    );
  }

  // SESSION SETUP VIEW
  if (view === 'setup') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => { setView('home'); resetSessionState(); }} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold">Start Session</h1>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium mb-3">Select Pitch Type</h2>
              <div className="grid grid-cols-2 gap-3">
                {PITCH_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    onClick={() => setSelectedPitchType(pt.value)}
                    className={`p-4 rounded-xl text-left transition-all
                      ${selectedPitchType === pt.value ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-gray-800 hover:bg-gray-700'}`}
                  >
                    <p className="font-medium">{pt.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-medium mb-3">Select Players ({selectedPlayerIds.length})</h2>
              <PlayerSelector
                players={players}
                selectedIds={selectedPlayerIds}
                onToggle={togglePlayerSelection}
              />
            </div>

            <button
              onClick={startSession}
              disabled={selectedPlayerIds.length === 0 || !selectedPitchType}
              className={`w-full py-4 rounded-xl font-medium text-lg transition-all
                ${selectedPlayerIds.length > 0 && selectedPitchType
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
            >
              Start Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE SESSION VIEW
  if (view === 'session') {
    const sessionPlayersData = players.filter(p => selectedPlayerIds.includes(p.id));
    const repsCount = getPlayerRepCount();
    const currentPlayerReps = sessionReps.filter(r => r.playerId === activePlayerId);

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400">{getPitchTypeLabel(selectedPitchType)}</p>
              <p className="text-lg font-bold">{sessionReps.length} total reps</p>
            </div>
            <button
              onClick={endSession}
              className="px-4 py-2 bg-red-600 rounded-lg font-medium hover:bg-red-700"
            >
              End Session
            </button>
          </div>

          <PlayerTabs
            players={sessionPlayersData}
            activeId={activePlayerId}
            onSelect={setActivePlayerId}
            repsCount={repsCount}
          />

          <div className="mt-4 space-y-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <label className="text-sm font-medium text-gray-300 mb-3 block">Pitch Location</label>
              <StrikeZone
                selected={currentRep.pitchLocation}
                onSelect={(zone) => setCurrentRep({...currentRep, pitchLocation: zone})}
              />
            </div>

            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <ToggleGroup
                label="Hard Hit?"
                options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
                selected={currentRep.hardHit}
                onSelect={(val) => setCurrentRep({...currentRep, hardHit: val})}
                columns={2}
              />

              <ToggleGroup
                label="Launch Angle"
                options={[
                  { value: 'fly', label: 'Fly Ball' },
                  { value: 'line', label: 'Line Drive' },
                  { value: 'ground', label: 'Ground Ball' },
                  { value: 'miss', label: 'Miss' }
                ]}
                selected={currentRep.launchAngle}
                onSelect={(val) => setCurrentRep({...currentRep, launchAngle: val})}
                columns={4}
              />

              <ToggleGroup
                label="Direction"
                options={[
                  { value: 'pull', label: 'Pull' },
                  { value: 'middle', label: 'Middle' },
                  { value: 'oppo', label: 'Oppo' }
                ]}
                selected={currentRep.direction}
                onSelect={(val) => setCurrentRep({...currentRep, direction: val})}
                columns={3}
              />

              <ToggleGroup
                label="Spin"
                options={[
                  { value: 'top', label: 'Top' },
                  { value: 'back', label: 'Back' },
                  { value: 'side', label: 'Side/Flare' }
                ]}
                selected={currentRep.spin}
                onSelect={(val) => setCurrentRep({...currentRep, spin: val})}
                columns={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetCurrentRep}
                className="flex-1 py-4 bg-gray-700 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-600 active:scale-95"
              >
                <RotateCcw size={20} />
                Reset
              </button>
              <button
                onClick={logRep}
                disabled={!isRepComplete()}
                className={`flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-medium active:scale-95
                  ${isRepComplete() ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
              >
                <Save size={20} />
                Log Rep
              </button>
            </div>

            {currentPlayerReps.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-medium mb-2">{players.find(p => p.id === activePlayerId)?.name} - This Session</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Hard Hit</p>
                    <p className="text-xl font-bold">
                      {((currentPlayerReps.filter(r => r.hardHit === 'yes').length / currentPlayerReps.length) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Line Drive</p>
                    <p className="text-xl font-bold">
                      {((currentPlayerReps.filter(r => r.launchAngle === 'line').length / currentPlayerReps.filter(r => r.launchAngle !== 'miss').length) * 100 || 0).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Backspin</p>
                    <p className="text-xl font-bold">
                      {((currentPlayerReps.filter(r => r.spin === 'back').length / currentPlayerReps.filter(r => r.launchAngle !== 'miss').length) * 100 || 0).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ANALYTICS VIEW
  if (view === 'analytics') {
    const stats = selectedPlayerId ? getPlayerStats(selectedPlayerId) : null;

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('home')} className="p-2 hover:bg-gray-800 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold">Analytics</h1>
          </div>

          <div className="space-y-4">
            <select
              value={selectedPlayerId || ''}
              onChange={(e) => {
                setSelectedPlayerId(e.target.value || null);
                // Reset filters when changing player
                setAnalyticsFilters({ pitchType: null, dateRange: 'all', sessionId: null, startDate: null, endDate: null });
              }}
              className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white"
            >
              <option value="">Select a player</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>

            {selectedPlayerId && (
              <AnalyticsFilter
                filters={analyticsFilters}
                setFilters={setAnalyticsFilters}
                pitchTypes={PITCH_TYPES}
                sessions={sessions}
                sessionPlayers={sessionPlayers}
                selectedPlayerId={selectedPlayerId}
                players={players}
              />
            )}

            {stats ? (
              <div className="space-y-4">
                {/* Key Metrics with Trends */}
                <div className="bg-gray-800 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Key Metrics</h3>
                    <span className="text-xs text-gray-500">{stats.totalReps} reps</span>
                  </div>
                  <div className="grid gap-3">
                    <MetricCard 
                      label="Hard Hit %" 
                      value={stats.hardHitRate}
                      vsLast5={stats.last5?.hardHitRate}
                      vsLastMonth={stats.lastMonth?.hardHitRate}
                    />
                    <MetricCard 
                      label="Line Drive %" 
                      value={stats.lineDriveRate}
                      vsLast5={stats.last5?.lineDriveRate}
                      vsLastMonth={stats.lastMonth?.lineDriveRate}
                    />
                    <MetricCard 
                      label="Backspin %" 
                      value={stats.backspinRate}
                      vsLast5={stats.last5?.backspinRate}
                      vsLastMonth={stats.lastMonth?.backspinRate}
                    />
                  </div>
                </div>

                {/* Heat Map */}
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="font-medium mb-3">Hard Hit % by Zone</h3>
                  <StrikeZone heatMapData={stats.zones} />
                  <div className="flex justify-center gap-4 mt-3 text-xs">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-600 rounded"></div> 50%+</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-600 rounded"></div> 35-49%</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-600 rounded"></div> 20-34%</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-600 rounded"></div> &lt;20%</div>
                  </div>
                </div>

                {/* Launch Angle Distribution */}
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="font-medium mb-3">Launch Angle</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Fly Ball', value: stats.launchAngle.flyBall, color: 'bg-purple-500' },
                      { label: 'Line Drive', value: stats.launchAngle.lineDrive, color: 'bg-green-500' },
                      { label: 'Ground Ball', value: stats.launchAngle.groundBall, color: 'bg-yellow-500' },
                      { label: 'Miss', value: stats.launchAngle.miss, color: 'bg-red-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span className="w-24 text-sm text-gray-400">{item.label}</span>
                        <div className="flex-1 h-6 bg-gray-700 rounded overflow-hidden">
                          <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }} />
                        </div>
                        <span className="w-12 text-sm text-right">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Direction */}
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="font-medium mb-3">Direction (on contact)</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xl font-bold">{stats.direction.pull}%</p>
                      <p className="text-xs text-gray-400">Pull</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{stats.direction.middle}%</p>
                      <p className="text-xs text-gray-400">Middle</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{stats.direction.oppo}%</p>
                      <p className="text-xs text-gray-400">Oppo</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-500">
                {selectedPlayerId ? 'No data for selected filters' : 'Select a player to view their stats'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
