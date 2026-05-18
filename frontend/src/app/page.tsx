"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Wifi, 
  WifiOff, 
  Activity, 
  Database, 
  Cpu, 
  Search, 
  Plus, 
  RefreshCw, 
  Sparkles, 
  Zap, 
  Flame, 
  AlertCircle
} from 'lucide-react';
import { getSocket } from '@/lib/socket';
import styles from './page.module.css';

interface FeedItem {
  _id: string;
  title: string;
  content: string;
  coachName: string;
  tag: 'Strategy' | 'Motivation' | 'Tactics' | 'Technical' | 'Mindset';
  colorTheme: 'purple' | 'orange' | 'cyan' | 'green' | 'pink';
  claps: number;
  createdAt: string;
}

interface ToastMessage {
  id: string;
  title: string;
  body: string;
}

export default function FeedDashboard() {
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Connection states
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  
  // Cache efficiency tracking from backend response
  const [cacheMeta, setCacheMeta] = useState<{ fromCache: boolean; isRedis: boolean }>({
    fromCache: false,
    isRedis: false
  });
  
  // UI controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  
  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Hydration safety
  const [isMounted, setIsMounted] = useState<boolean>(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // 1. Fetch initial feeds on load
  const fetchFeeds = async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/feed`);
      if (!res.ok) throw new Error('Failed to fetch data from Express server');
      
      const json = await res.json();
      if (json.success) {
        setFeeds(json.data);
        setCacheMeta({
          fromCache: json.fromCache,
          isRedis: json.isRedis
        });
      } else {
        throw new Error(json.message || 'API returned failure');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Could not connect to the API server. Make sure your backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchFeeds();
  }, []);

  // 2. WebSocket listener setup
  useEffect(() => {
    if (!isMounted) return;

    const socket = getSocket();

    // Set initial connection status
    setConnectionStatus(socket.connected ? 'connected' : 'disconnected');

    // Socket Event: Connect
    const onConnect = () => {
      setConnectionStatus('connected');
      console.log('🔌 Connected to websocket!');
      // Refresh feed on reconnection to fetch any missed items
      fetchFeeds(false);
    };

    // Socket Event: Disconnect
    const onDisconnect = () => {
      setConnectionStatus('disconnected');
      console.log('🔌 Websocket disconnected');
    };

    // Socket Event: Reconnect Attempt
    const onReconnectAttempt = () => {
      setConnectionStatus('reconnecting');
      console.log('🔌 Websocket reconnecting...');
    };

    // Socket Event: New feed item published
    const onNewFeed = (newFeed: FeedItem) => {
      console.log('📡 Received real-time "feed:new":', newFeed);
      
      // Prevent duplicate socket events by checking if _id already exists
      setFeeds(prev => {
        const exists = prev.some(f => f._id === newFeed._id);
        if (exists) return prev;
        return [newFeed, ...prev];
      });

      // Spawn toast notification
      const toastId = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = {
        id: toastId,
        title: `🔥 New Insight from Coach ${newFeed.coachName}!`,
        body: newFeed.title
      };
      
      setToasts(prev => [newToast, ...prev]);

      // Auto dismiss toast after 5s
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 5000);
    };

    // Socket Event: Clap incremented
    const onFeedClap = (data: { id: string; claps: number }) => {
      console.log('📡 Received real-time "feed:clap":', data);
      setFeeds(prev => prev.map(feed => 
        feed._id === data.id ? { ...feed, claps: data.claps } : feed
      ));
    };

    // Bind listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onReconnectAttempt);
    socket.on('feed:new', onNewFeed);
    socket.on('feed:clap', onFeedClap);

    // If socket is already connected when effect runs
    if (socket.connected) {
      setConnectionStatus('connected');
    }

    // Cleanup listeners on component unmount to prevent duplicate events and memory leaks!
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onReconnectAttempt);
      socket.off('feed:new', onNewFeed);
      socket.off('feed:clap', onFeedClap);
    };
  }, [isMounted]);

  // 3. Increment Claps API Call
  const handleClap = async (feedId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Optimistic update for fluid UI transition
    setFeeds(prev => prev.map(feed => 
      feed._id === feedId ? { ...feed, claps: feed.claps + 1 } : feed
    ));

    try {
      const res = await fetch(`${API_URL}/feed/${feedId}/clap`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to record clap on server');
      }
    } catch (err) {
      console.error('Clap error:', err);
      // Revert optimistic update if API failed
      setFeeds(prev => prev.map(feed => 
        feed._id === feedId ? { ...feed, claps: Math.max(0, feed.claps - 1) } : feed
      ));
    }
  };

  // Dismiss a specific toast
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Filter and Search Logic
  const filteredFeeds = useMemo(() => {
    return feeds.filter(feed => {
      const matchesCategory = activeCategory === 'All' || feed.tag === activeCategory;
      const matchesSearch = feed.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            feed.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            feed.coachName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [feeds, activeCategory, searchQuery]);

  // Total claps selector
  const totalClaps = useMemo(() => {
    return feeds.reduce((sum, feed) => sum + feed.claps, 0);
  }, [feeds]);

  // Date Formatting Helper (Hydration-safe)
  const formatTimeAgo = (dateStr: string) => {
    if (!isMounted) return 'Loading date...';
    
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  // Theme translation classes helper
  const getThemeClass = (theme: string) => {
    switch (theme) {
      case 'orange': return styles.themeOrange;
      case 'cyan': return styles.themeCyan;
      case 'green': return styles.themeGreen;
      case 'pink': return styles.themePink;
      default: return styles.themePurple;
    }
  };

  // Manual reconnect handler
  const handleReconnect = () => {
    if (connectionStatus !== 'connected') {
      console.log('🔄 Manually initiating websocket reconnect...');
      getSocket().connect();
    }
  };

  return (
    <div className={styles.container}>
      {/* 1. Header Navigation */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <Activity size={32} className={styles.pulseIcon} />
          <h1 className={styles.brandTitle}>ProPulse</h1>
        </div>

        <div className="flex gap-4 items-center">
          <div 
            className={`glass ${styles.statusBadge}`}
            onClick={handleReconnect}
            title={connectionStatus !== 'connected' ? 'Click to reconnect' : 'WebSocket Active'}
          >
            {connectionStatus === 'connected' ? (
              <>
                <span className={`${styles.statusDot} ${styles.statusConnected}`} />
                <span style={{ color: 'var(--text-secondary)' }}>Live Sync Active</span>
              </>
            ) : connectionStatus === 'reconnecting' ? (
              <>
                <span className={`${styles.statusDot} ${styles.statusReconnecting}`} />
                <span style={{ color: 'var(--accent-orange)' }}>Connecting...</span>
              </>
            ) : (
              <>
                <span className={`${styles.statusDot} ${styles.statusDisconnected}`} />
                <span style={{ color: 'var(--accent-pink)' }}>Offline (Reconnect)</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Stats Summary Dashboard */}
      <section className={styles.statsGrid}>
        <div className={`glass ${styles.statCard}`}>
          <div className={styles.statLabel}>Coaching Feeds</div>
          <div className={styles.statValue}>
            {isLoading ? (
              <span style={{ width: '40px', height: '32px', borderRadius: '4px' }} className="shimmer-bg" />
            ) : (
              feeds.length
            )}
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>total</span>
          </div>
        </div>

        <div className={`glass ${styles.statCard}`}>
          <div className={styles.statLabel}>Cache Status</div>
          <div>
            <div className={styles.statValue} style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px' }}>
              {isLoading ? (
                <span style={{ width: '120px', height: '24px', borderRadius: '4px' }} className="shimmer-bg" />
              ) : cacheMeta.fromCache ? (
                cacheMeta.isRedis ? 'Redis Active ⚡' : 'In-Memory Active ⚡'
              ) : (
                'Database Fetched 💾'
              )}
            </div>
            {isMounted && !isLoading && (
              <span className={`${styles.cachePill} ${cacheMeta.fromCache ? styles.redisCache : styles.dbCache}`}>
                {cacheMeta.fromCache ? 'Cache HIT' : 'Cache MISS'}
              </span>
            )}
          </div>
        </div>

        <div className={`glass ${styles.statCard}`}>
          <div className={styles.statLabel}>Engagement</div>
          <div className={styles.statValue}>
            {isLoading ? (
              <span style={{ width: '60px', height: '32px', borderRadius: '4px' }} className="shimmer-bg" />
            ) : (
              totalClaps
            )}
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>claps</span>
          </div>
        </div>

        <div className={`glass ${styles.statCard}`} style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Link href="/admin" className={styles.adminLink}>
            <Plus size={18} />
            Write Insight
          </Link>
        </div>
      </section>

      {/* 3. Search and Categories Filter Bar */}
      <section className={styles.controlsRow}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search feeds, titles, or coaches..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterTabs}>
          {['All', 'Strategy', 'Motivation', 'Tactics', 'Technical', 'Mindset'].map((category) => (
            <button
              key={category}
              className={`${styles.tab} ${activeCategory === category ? styles.tabActive : ''}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* 4. Feeds Stream */}
      <main className={styles.feedList}>
        {isLoading ? (
          // Circular Loading Spinner
          <div className={`${styles.loadingContainer} glass animate-fade-in`}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Tuning into the coaching pulse...</p>
          </div>
        ) : error ? (
          // Error screen
          <div className={`glass ${styles.emptyState} animate-fade-in`}>
            <AlertCircle size={48} style={{ color: 'var(--accent-pink)' }} />
            <h3 className={styles.emptyTitle}>Connection Failed</h3>
            <p className={styles.emptyText}>{error}</p>
            <button className={styles.retryButton} onClick={() => fetchFeeds()}>
              <RefreshCw size={16} style={{ marginRight: '8px', display: 'inline' }} />
              Retry Connection
            </button>
          </div>
        ) : filteredFeeds.length === 0 ? (
          // Empty State
          <div className={`glass ${styles.emptyState} animate-fade-in`}>
            <Sparkles size={48} style={{ color: 'var(--text-muted)' }} />
            <h3 className={styles.emptyTitle}>No Insights Streamed</h3>
            <p className={styles.emptyText}>
              {searchQuery || activeCategory !== 'All' 
                ? "No coaching feeds match your active search or category filters."
                : "The stream is empty. Head to the admin dashboard to publish the first coaching feed!"
              }
            </p>
            {(searchQuery || activeCategory !== 'All') && (
              <button 
                className={styles.retryButton}
                onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          // Light Theme Data Table for Coaching Feed Stream
          <div className={`${styles.tableWrapper} animate-fade-in`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Coach</th>
                  <th className={styles.th}>Category</th>
                  <th className={styles.th}>Insight Heading</th>
                  <th className={styles.th}>Streamed</th>
                  <th className={styles.th} style={{ textAlign: 'center' }}>Reactions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeeds.map((feed) => {
                  // Get avatar theme class
                  const getAvatarClass = (theme: string) => {
                    switch (theme) {
                      case 'orange': return styles.avatarOrange;
                      case 'cyan': return styles.avatarCyan;
                      case 'green': return styles.avatarGreen;
                      case 'pink': return styles.avatarPink;
                      default: return styles.avatarPurple;
                    }
                  };

                  return (
                    <tr 
                      key={feed._id} 
                      className={`${styles.tr} ${getThemeClass(feed.colorTheme)}`}
                    >
                      <td className={styles.td}>
                        <div className={styles.coachCell}>
                          <div className={`${styles.coachAvatar} ${getAvatarClass(feed.colorTheme)}`}>
                            {feed.coachName.charAt(0).toUpperCase()}
                          </div>
                          <span className={styles.coachNameText}>Coach {feed.coachName}</span>
                        </div>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.tagPill}>{feed.tag}</span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.titleCell}>
                          <div className={styles.tableFeedTitle}>{feed.title}</div>
                          <div className={styles.tableFeedContent}>{feed.content}</div>
                        </div>
                      </td>
                      <td className={styles.td} style={{ whiteSpace: 'nowrap' }}>
                        <span className={styles.timeAgoText}>{formatTimeAgo(feed.createdAt)}</span>
                      </td>
                      <td className={styles.td} style={{ textAlign: 'center' }}>
                        <button 
                          className={styles.tableClapButton}
                          onClick={(e) => handleClap(feed._id, e)}
                        >
                          <Flame size={16} className={styles.clapIcon} fill={feed.claps > 0 ? "currentColor" : "none"} />
                          <span className={styles.clapCount}>{feed.claps}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 5. Real-time Toast Notifications Popup */}
      <div className={styles.toastContainer}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`glass ${styles.toast}`}>
            <Zap size={20} style={{ color: 'var(--accent-orange)', marginTop: '2px' }} />
            <div className={styles.toastContent}>
              <div className={styles.toastTitle}>{toast.title}</div>
              <div className={styles.toastBody}>{toast.body}</div>
            </div>
            <button className={styles.toastClose} onClick={() => dismissToast(toast.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
