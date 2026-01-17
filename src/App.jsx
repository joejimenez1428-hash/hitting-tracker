import React, { useState, useEffect, useCallback } from 'react';
import { Plus, User, TrendingUp, ChevronRight, RotateCcw, Save, ArrowLeft, Trash2, Wifi, WifiOff, RefreshCw, Settings, X } from 'lucide-react';

// ===========================================
// CONFIGURATION - You'll update these values
// ===========================================
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// ===========================================
// Supabase Client
// ===========================================
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  async query(table, method = 'GET', body = null, queryParams = '') {
    const options = {
      method,
      headers: this.headers,
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(
      `${this.url}/rest/v1/${table}${queryParams}`,
      options
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase error: ${error}`);
    }
    
    if (method === 'DELETE') return null;
    return response.json();
  }

  // Players
  async getPlayers() {
    return this.query('players', 'GET', null, '?order=name.asc');
  }

  async createPlayer(name) {
    return this.query('players', 'POST', { name });
  }

  async deletePlayer(id) {
    return this.query('players', 'DELETE', null, `?id=eq.${id}`);
  }

  // Sessions
  async getSessions() {
    return this.query('sessions', 'GET', null, '?order=date.desc');
  }

  async createSession(playerId) {
    return this.query('sessions', 'POST', { player_id: playerId });
  }

  // Reps
  async getReps() {
    return this.query('reps', 'GET', null, '?order=created_at.asc');
  }

  async createReps(reps) {
    return this.query('reps', 'POST', reps);
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===========================================
// Local Storage for Offline Queue
// ===========================================
const OFFLINE_QUEUE_KEY = 'hitting_tracker_offline_queue';
const LOCAL_CACHE_KEY = 'hitting_tracker_cache';

const getOfflineQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};

const addToOfflineQueue = (action) => {
  const queue = getOfflineQueue();
  queue.push({ ...action, timestamp: Date.now() });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const clearOfflineQueue = () => {
  localStorage.setItem(OFFLINE_QUEUE_KEY, '[]');
};

const getLocalCache = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const setLocalCache = (data) => {
  localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
};

// ===========================================
// Components
// ===========================================

// Strike Zone Component
const StrikeZone = ({ selected, onSelect }) => {
  const zones = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
  ];
  
  const getZoneLabel = (zone) => {
    const labels = {
      1: 'Up & In', 2: 'Up Middle', 3: 'Up & Away',
      4: 'Middle In', 5: 'Heart', 6: 'Middle Away',
      7: 'Down & In', 8: 'Down Middle', 9: 'Down & Away'
    };
    return labels[zone];
  };

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-3 gap-1 bg-gray-800 p-2 rounded-lg">
        {zones.map((row, rowIdx) => (
          row.map((zone) => (
            <button
              key={zone}
              onClick={() => onSelect(zone)}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded flex items-center justify-center text-sm font-medium transition-all active:scale-95
                ${selected === zone 
                  ? 'bg-blue-500 text-white ring-2 ring-blue-300' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500'}`}
            >
              {zone}
            </button>
          ))
        ))}
      </div>
      {selected && (
        <p className="mt-2 text-sm text-gray-400">{getZoneLabel(selected)}</p>
      )}
    </div>
  );
};

// Toggle Button Group Component
const ToggleGroup = ({ label, options, selected, onSelect, columns = 2 }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={`px-3 py-3 rounded-lg text-sm font-medium transition-all active:scale-95
              ${selected === option.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Connection Status Badge
const ConnectionStatus = ({ isOnline, pendingCount, onSync }) => {
  return (
    <div className="flex items-center gap-2">
      {pendingCount > 0 && (
        <button
          onClick={onSync}
          className="flex items-center gap-1 px-2 py-1 bg-yellow-600 rounded text-xs"
        >
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
};

// Settings Modal
const SettingsModal = ({ isOpen, onClose, supabaseUrl, supabaseKey, onSave }) => {
  const [url, setUrl] = useState(supabaseUrl);
  const [key, setKey] = useState(supabaseKey);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Supabase Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X size={20} />
          </button>
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
            onClick={() => {
              onSave(url, key);
              onClose();
            }}
            className="w-full py-3 bg-blue-500 rounded-lg font-medium hover:bg-blue-600"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};

// ===========================================
// Main App Component
// ===========================================
export default function HittingTrackerCloud() {
  // Config state
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('hitting_tracker_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      supabase.url = parsed.url;
      supabase.key = parsed.key;
      supabase.headers = {
        'apikey': parsed.key,
        'Authorization': `Bearer ${parsed.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };
      return parsed;
    }
    return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
  });
  const [showSettings, setShowSettings] = useState(false);

  // App state
  const [view, setView] = useState('players');
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [reps, setReps] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);

  // Current rep state
  const [currentRep, setCurrentRep] = useState({
    pitchLocation: null,
    hardHit: null,
    launchAngle: null,
    direction: null,
    spin: null
  });
  const [sessionReps, setSessionReps] = useState([]);
  const [repCount, setRepCount] = useState(1);

  // Analytics state
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

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

  // Load pending actions from queue
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
    localStorage.setItem('hitting_tracker_config', JSON.stringify(newConfig));
    supabase.url = url;
    supabase.key = key;
    supabase.headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    setConfig(newConfig);
  };

  const loadData = async () => {
    if (config.url === 'YOUR_SUPABASE_URL') {
      setIsLoading(false);
      setShowSettings(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Try to load from cache first
    const cache = getLocalCache();
    if (cache.players) setPlayers(cache.players);
    if (cache.sessions) setSessions(cache.sessions);
    if (cache.reps) setReps(cache.reps);

    if (!isOnline) {
      setIsLoading(false);
      return;
    }

    try {
      const [playersData, sessionsData, repsData] = await Promise.all([
        supabase.getPlayers(),
        supabase.getSessions(),
        supabase.getReps()
      ]);

      setPlayers(playersData || []);
      setSessions(sessionsData || []);
      setReps(repsData || []);

      // Update cache
      setLocalCache({
        players: playersData || [],
        sessions: sessionsData || [],
        reps: repsData || [],
        lastUpdated: Date.now()
      });

      setLastSync(new Date());
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to connect. Check your Supabase settings.');
    }
    
    setIsLoading(false);
  };

  const syncOfflineActions = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setError(null);
    
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
            const [session] = await supabase.createSession(action.data.playerId);
            if (session && action.data.reps.length > 0) {
              const repsToCreate = action.data.reps.map(r => ({
                session_id: session.id,
                player_id: action.data.playerId,
                rep_number: r.repNumber,
                pitch_location: r.pitchLocation,
                hard_hit: r.hardHit,
                launch_angle: r.launchAngle,
                direction: r.direction,
                spin: r.spin
              }));
              await supabase.createReps(repsToCreate);
            }
            break;
        }
      } catch (err) {
        console.error('Failed to sync action:', action, err);
        setError('Some data failed to sync. Will retry.');
        return; // Stop processing, will retry later
      }
    }

    // All synced successfully
    clearOfflineQueue();
    setPendingActions([]);
    await loadData(); // Refresh data
  };

  const addPlayer = async () => {
    if (!newPlayerName.trim()) return;
    
    const tempId = `temp_${Date.now()}`;
    const newPlayer = {
      id: tempId,
      name: newPlayerName.trim(),
      created_at: new Date().toISOString()
    };

    // Optimistic update
    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
    setShowAddPlayer(false);

    if (isOnline) {
      try {
        const [created] = await supabase.createPlayer(newPlayerName.trim());
        // Replace temp with real
        setPlayers(prev => prev.map(p => p.id === tempId ? created : p));
        // Update cache
        const cache = getLocalCache();
        cache.players = players.map(p => p.id === tempId ? created : p);
        setLocalCache(cache);
      } catch (err) {
        console.error('Failed to create player:', err);
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

    // Optimistic update
    setPlayers(players.filter(p => p.id !== playerId));
    setSessions(sessions.filter(s => s.player_id !== playerId));
    setReps(reps.filter(r => r.player_id !== playerId));

    if (isOnline && !playerId.startsWith('temp_')) {
      try {
        await supabase.deletePlayer(playerId);
      } catch (err) {
        console.error('Failed to delete player:', err);
        addToOfflineQueue({ type: 'DELETE_PLAYER', data: { id: playerId } });
        setPendingActions(getOfflineQueue());
      }
    } else if (!playerId.startsWith('temp_')) {
      addToOfflineQueue({ type: 'DELETE_PLAYER', data: { id: playerId } });
      setPendingActions(getOfflineQueue());
    }
  };

  const startSession = (player) => {
    setCurrentPlayer(player);
    setSessionReps([]);
    setRepCount(1);
    resetCurrentRep();
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
    
    setSessionReps([...sessionReps, { ...currentRep, repNumber: repCount }]);
    setRepCount(repCount + 1);
    resetCurrentRep();
  };

  const endRound = async () => {
    if (sessionReps.length === 0) {
      setView('players');
      return;
    }

    const sessionData = {
      playerId: currentPlayer.id,
      reps: sessionReps
    };

    // Create temp session for optimistic update
    const tempSessionId = `temp_${Date.now()}`;
    const tempSession = {
      id: tempSessionId,
      player_id: currentPlayer.id,
      date: new Date().toISOString()
    };
    const tempReps = sessionReps.map((r, i) => ({
      id: `temp_rep_${Date.now()}_${i}`,
      session_id: tempSessionId,
      player_id: currentPlayer.id,
      rep_number: r.repNumber,
      pitch_location: r.pitchLocation,
      hard_hit: r.hardHit,
      launch_angle: r.launchAngle,
      direction: r.direction,
      spin: r.spin
    }));

    // Optimistic update
    setSessions([tempSession, ...sessions]);
    setReps([...reps, ...tempReps]);

    if (isOnline && !currentPlayer.id.startsWith('temp_')) {
      try {
        const [session] = await supabase.createSession(currentPlayer.id);
        if (session) {
          const repsToCreate = sessionReps.map(r => ({
            session_id: session.id,
            player_id: currentPlayer.id,
            rep_number: r.repNumber,
            pitch_location: r.pitchLocation,
            hard_hit: r.hardHit,
            launch_angle: r.launchAngle,
            direction: r.direction,
            spin: r.spin
          }));
          await supabase.createReps(repsToCreate);
          await loadData(); // Refresh to get real IDs
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

    setCurrentPlayer(null);
    setSessionReps([]);
    setRepCount(1);
    resetCurrentRep();
    setView('players');
  };

  const getPlayerStats = (playerId) => {
    const playerReps = reps.filter(r => r.player_id === playerId);
    const playerSessions = sessions.filter(s => s.player_id === playerId);
    
    if (playerReps.length === 0) return null;

    const contactReps = playerReps.filter(r => r.launch_angle !== 'miss');
    
    const stats = {
      totalReps: playerReps.length,
      totalSessions: playerSessions.length,
      hardHitRate: (playerReps.filter(r => r.hard_hit === 'yes').length / playerReps.length * 100).toFixed(1),
      contactRate: (contactReps.length / playerReps.length * 100).toFixed(1),
      
      launchAngle: {
        flyBall: (playerReps.filter(r => r.launch_angle === 'fly').length / playerReps.length * 100).toFixed(1),
        lineDrive: (playerReps.filter(r => r.launch_angle === 'line').length / playerReps.length * 100).toFixed(1),
        groundBall: (playerReps.filter(r => r.launch_angle === 'ground').length / playerReps.length * 100).toFixed(1),
        miss: (playerReps.filter(r => r.launch_angle === 'miss').length / playerReps.length * 100).toFixed(1),
      },
      
      direction: {
        pull: (contactReps.filter(r => r.direction === 'pull').length / (contactReps.length || 1) * 100).toFixed(1),
        middle: (contactReps.filter(r => r.direction === 'middle').length / (contactReps.length || 1) * 100).toFixed(1),
        oppo: (contactReps.filter(r => r.direction === 'oppo').length / (contactReps.length || 1) * 100).toFixed(1),
      },
      
      spin: {
        top: (contactReps.filter(r => r.spin === 'top').length / (contactReps.length || 1) * 100).toFixed(1),
        back: (contactReps.filter(r => r.spin === 'back').length / (contactReps.length || 1) * 100).toFixed(1),
        side: (contactReps.filter(r => r.spin === 'side').length / (contactReps.length || 1) * 100).toFixed(1),
      },
      
      zones: Array.from({length: 9}, (_, i) => {
        const zoneReps = playerReps.filter(r => r.pitch_location === i + 1);
        const zoneContact = zoneReps.filter(r => r.launch_angle !== 'miss');
        return {
          zone: i + 1,
          total: zoneReps.length,
          hardHitRate: zoneReps.length > 0 
            ? (zoneReps.filter(r => r.hard_hit === 'yes').length / zoneReps.length * 100).toFixed(1)
            : '0.0',
          contactRate: zoneReps.length > 0
            ? (zoneContact.length / zoneReps.length * 100).toFixed(1)
            : '0.0'
        };
      })
    };

    return stats;
  };

  const getRollingStats = (playerId, lastN = 5) => {
    const playerSessions = sessions
      .filter(s => s.player_id === playerId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, lastN);
    
    const sessionIds = new Set(playerSessions.map(s => s.id));
    const recentReps = reps.filter(r => sessionIds.has(r.session_id));
    
    if (recentReps.length === 0) return null;

    return {
      sessions: playerSessions.length,
      reps: recentReps.length,
      hardHitRate: (recentReps.filter(r => r.hard_hit === 'yes').length / recentReps.length * 100).toFixed(1),
      contactRate: (recentReps.filter(r => r.launch_angle !== 'miss').length / recentReps.length * 100).toFixed(1),
    };
  };

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

  // Player Selection View
  if (view === 'players') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold">Hitting Tracker</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={() => setView('analytics')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <TrendingUp size={18} />
                <span className="hidden sm:inline">Analytics</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <ConnectionStatus 
              isOnline={isOnline} 
              pendingCount={pendingActions.length}
              onSync={syncOfflineActions}
            />
            {lastSync && (
              <p className="text-xs text-gray-500">
                Last sync: {lastSync.toLocaleTimeString()}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-3 mb-6">
            <h2 className="text-lg font-medium text-gray-300">Select Player</h2>
            {players.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">No players yet. Add your first player below.</p>
            ) : (
              players.map((player) => {
                const stats = getPlayerStats(player.id);
                return (
                  <div
                    key={player.id}
                    className="bg-gray-800 rounded-xl p-4 flex items-center justify-between"
                  >
                    <button
                      onClick={() => startSession(player)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${player.id.startsWith('temp_') ? 'bg-yellow-600' : 'bg-blue-600'}`}>
                        <User size={20} />
                      </div>
                      <div>
                        <p className="font-medium">{player.name}</p>
                        {stats ? (
                          <p className="text-sm text-gray-400">
                            {stats.totalReps} reps · {stats.hardHitRate}% hard hit · {stats.contactRate}% contact
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500">No sessions yet</p>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => deletePlayer(player.id)}
                        className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                      <ChevronRight className="text-gray-500" size={20} />
                    </div>
                  </div>
                );
              })
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
                <button
                  onClick={addPlayer}
                  className="flex-1 py-3 bg-blue-500 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  Add Player
                </button>
                <button
                  onClick={() => { setShowAddPlayer(false); setNewPlayerName(''); }}
                  className="px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddPlayer(true)}
              className="w-full py-4 bg-gray-800 rounded-xl flex items-center justify-center gap-2 text-gray-300 hover:bg-gray-750 hover:text-white transition-colors border-2 border-dashed border-gray-700"
            >
              <Plus size={20} />
              Add Player
            </button>
          )}
        </div>

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          supabaseUrl={config.url}
          supabaseKey={config.key}
          onSave={saveConfig}
        />
      </div>
    );
  }

  // Session/Logging View
  if (view === 'session') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">{currentPlayer?.name}</h1>
              <p className="text-gray-400">Rep #{repCount} · {sessionReps.length} logged</p>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionStatus 
                isOnline={isOnline} 
                pendingCount={pendingActions.length}
                onSync={syncOfflineActions}
              />
              <button
                onClick={endRound}
                className="px-4 py-2 bg-red-600 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                End Round
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Strike Zone */}
            <div className="bg-gray-800 rounded-xl p-4">
              <label className="text-sm font-medium text-gray-300 mb-3 block">Pitch Location</label>
              <StrikeZone
                selected={currentRep.pitchLocation}
                onSelect={(zone) => setCurrentRep({...currentRep, pitchLocation: zone})}
              />
            </div>

            {/* Quick Toggles */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-4">
              <ToggleGroup
                label="Hard Hit?"
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' }
                ]}
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

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={resetCurrentRep}
                className="flex-1 py-4 bg-gray-700 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-600 transition-colors active:scale-95"
              >
                <RotateCcw size={20} />
                Reset
              </button>
              <button
                onClick={logRep}
                disabled={!isRepComplete()}
                className={`flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all active:scale-95
                  ${isRepComplete() 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
              >
                <Save size={20} />
                Log & Next
              </button>
            </div>

            {/* Session Summary */}
            {sessionReps.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-medium mb-2">This Session</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Hard Hit Rate</p>
                    <p className="text-xl font-bold">
                      {(sessionReps.filter(r => r.hardHit === 'yes').length / sessionReps.length * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Contact Rate</p>
                    <p className="text-xl font-bold">
                      {(sessionReps.filter(r => r.launchAngle !== 'miss').length / sessionReps.length * 100).toFixed(0)}%
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

  // Analytics View
  if (view === 'analytics') {
    const stats = selectedPlayerId ? getPlayerStats(selectedPlayerId) : null;
    const rolling = selectedPlayerId ? getRollingStats(selectedPlayerId) : null;

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setView('players')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold">Analytics</h1>
          </div>

          {/* Player Selector */}
          <div className="mb-6">
            <select
              value={selectedPlayerId || ''}
              onChange={(e) => setSelectedPlayerId(e.target.value || null)}
              className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a player</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </div>

          {stats ? (
            <div className="space-y-4">
              {/* Overview */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-medium mb-3">All-Time Stats</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Sessions</p>
                    <p className="text-2xl font-bold">{stats.totalSessions}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Total Reps</p>
                    <p className="text-2xl font-bold">{stats.totalReps}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Hard Hit %</p>
                    <p className="text-2xl font-bold text-green-400">{stats.hardHitRate}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Contact %</p>
                    <p className="text-2xl font-bold text-blue-400">{stats.contactRate}%</p>
                  </div>
                </div>
              </div>

              {/* Rolling Average */}
              {rolling && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <h3 className="font-medium mb-3">Last {rolling.sessions} Sessions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Hard Hit %</p>
                      <p className="text-2xl font-bold text-green-400">{rolling.hardHitRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Contact %</p>
                      <p className="text-2xl font-bold text-blue-400">{rolling.contactRate}%</p>
                    </div>
                  </div>
                </div>
              )}

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
                        <div 
                          className={`h-full ${item.color} transition-all`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                      <span className="w-12 text-sm text-right">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direction Distribution */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-medium mb-3">Direction (on contact)</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-gray-400 text-sm">Pull</p>
                    <p className="text-xl font-bold">{stats.direction.pull}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Middle</p>
                    <p className="text-xl font-bold">{stats.direction.middle}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Oppo</p>
                    <p className="text-xl font-bold">{stats.direction.oppo}%</p>
                  </div>
                </div>
              </div>

              {/* Spin Distribution */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-medium mb-3">Spin (on contact)</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-gray-400 text-sm">Top</p>
                    <p className="text-xl font-bold">{stats.spin.top}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Back</p>
                    <p className="text-xl font-bold">{stats.spin.back}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Side/Flare</p>
                    <p className="text-xl font-bold">{stats.spin.side}%</p>
                  </div>
                </div>
              </div>

              {/* Zone Breakdown */}
              <div className="bg-gray-800 rounded-xl p-4">
                <h3 className="font-medium mb-3">Zone Performance</h3>
                <div className="grid grid-cols-3 gap-1">
                  {stats.zones.map((zone) => (
                    <div 
                      key={zone.zone}
                      className={`p-3 rounded text-center ${zone.total > 0 ? 'bg-gray-700' : 'bg-gray-800'}`}
                    >
                      <p className="text-xs text-gray-400">Zone {zone.zone}</p>
                      {zone.total > 0 ? (
                        <>
                          <p className="font-bold text-green-400">{zone.hardHitRate}%</p>
                          <p className="text-xs text-gray-500">{zone.total} reps</p>
                        </>
                      ) : (
                        <p className="text-gray-600 text-sm">—</p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">Hard Hit % by zone</p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-500">
              {players.length === 0 
                ? 'Add players to see analytics'
                : 'Select a player to view their stats'}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
