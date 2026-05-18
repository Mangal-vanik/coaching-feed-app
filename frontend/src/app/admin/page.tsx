"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Sparkles, 
  Send, 
  CheckCircle,
  Eye,
  FileText,
  Flame,
  Award
} from 'lucide-react';
import styles from './page.module.css';
import feedStyles from '../page.module.css';

type TagType = 'Strategy' | 'Motivation' | 'Tactics' | 'Technical' | 'Mindset';
type ThemeType = 'purple' | 'orange' | 'cyan' | 'green' | 'pink';

interface FormState {
  coachName: string;
  title: string;
  content: string;
  tag: TagType;
  colorTheme: ThemeType;
}

export default function AdminDashboard() {
  const [form, setForm] = useState<FormState>({
    coachName: '',
    title: '',
    content: '',
    tag: 'Strategy',
    colorTheme: 'purple'
  });
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  
  const [validationErrors, setValidationErrors] = useState<Partial<FormState>>({});

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear validation error when typing
    if (validationErrors[name as keyof FormState]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const selectTheme = (theme: ThemeType) => {
    setForm(prev => ({
      ...prev,
      colorTheme: theme
    }));
  };

  const validate = (): boolean => {
    const errors: Partial<FormState> = {};
    if (!form.coachName.trim()) errors.coachName = 'Coach name is required';
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.content.trim()) errors.content = 'Content description is required';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to submit coaching feed item');
      }

      // Success! Trigger Modal
      setShowSuccess(true);
    } catch (err: any) {
      console.error('Submit error:', err);
      setError(err.message || 'Server connection error. Please check if your backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setForm({
      coachName: '',
      title: '',
      content: '',
      tag: 'Strategy',
      colorTheme: 'purple'
    });
    setValidationErrors({});
    setShowSuccess(false);
  };

  // Translate themes to card layout classes
  const getThemeClass = (theme: string) => {
    switch (theme) {
      case 'orange': return feedStyles.themeOrange;
      case 'cyan': return feedStyles.themeCyan;
      case 'green': return feedStyles.themeGreen;
      case 'pink': return feedStyles.themePink;
      default: return feedStyles.themePurple;
    }
  };

  return (
    <div className={styles.container}>
      {/* 1. Header Row */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <Award size={32} className={feedStyles.pulseIcon} />
          <h1 className={styles.brandTitle}>ProPulse Admin</h1>
        </div>

        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={16} />
          Stream Feed
        </Link>
      </header>

      {/* 2. Admin Splitscreen Layout */}
      <div className={styles.dashboardLayout}>
        {/* Left Side: Form */}
        <main className={`glass ${styles.formCard}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2 className={styles.formTitle}>
              <FileText size={20} style={{ color: 'var(--accent-purple)' }} />
              Draft New Coaching Insight
            </h2>
            <p className={styles.formSubtitle}>Publish real-time micro-coaching insights to all subscribed students.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {error && (
              <div style={{ color: 'var(--accent-pink)', fontSize: '0.9rem', padding: '10px', background: 'rgba(236, 72, 153, 0.1)', borderRadius: '8px', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
                ⚠️ {error}
              </div>
            )}

            <div className={styles.gridFields}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Coach Name</label>
                <input 
                  type="text" 
                  name="coachName"
                  placeholder="e.g. Coach Phil"
                  className={styles.input}
                  value={form.coachName}
                  onChange={handleChange}
                />
                {validationErrors.coachName && <span className={styles.errorText}>{validationErrors.coachName}</span>}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Insight Category</label>
                <select 
                  name="tag"
                  className={styles.select}
                  value={form.tag}
                  onChange={handleChange}
                >
                  <option value="Strategy">Strategy 🎯</option>
                  <option value="Motivation">Motivation 🔥</option>
                  <option value="Tactics">Tactics ⚔️</option>
                  <option value="Technical">Technical 💻</option>
                  <option value="Mindset">Mindset 🧠</option>
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Insight Heading</label>
              <input 
                type="text" 
                name="title"
                placeholder="e.g. Focus on the Process, Not the Outcome"
                className={styles.input}
                value={form.title}
                onChange={handleChange}
              />
              {validationErrors.title && <span className={styles.errorText}>{validationErrors.title}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Coaching Content</label>
              <textarea 
                name="content"
                placeholder="Write your insightful strategies, steps, or daily motivation..."
                className={styles.textarea}
                value={form.content}
                onChange={handleChange}
              />
              {validationErrors.content && <span className={styles.errorText}>{validationErrors.content}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Card Accent Glow</label>
              <div className={styles.themeSelector}>
                {(['purple', 'orange', 'cyan', 'green', 'pink'] as ThemeType[]).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => selectTheme(theme)}
                    className={`${styles.colorDot} ${form.colorTheme === theme ? styles.colorActive : ''} ${
                      theme === 'purple' ? styles.dotPurple :
                      theme === 'orange' ? styles.dotOrange :
                      theme === 'cyan' ? styles.dotCyan :
                      theme === 'green' ? styles.dotGreen :
                      styles.dotPink
                    }`}
                    title={`${theme.toUpperCase()} Accent`}
                  />
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              <Send size={16} />
              {isSubmitting ? 'Broadcasting Insight...' : 'Broadcast Realtime Insight'}
            </button>
          </form>
        </main>

        {/* Right Side: Preview */}
        <aside className={styles.previewColumn}>
          <div className={styles.previewLabel}>
            <Eye size={16} style={{ color: 'var(--text-muted)' }} />
            Live Layout Preview
          </div>

          {/* Render Feed Card using shared css module selectors */}
          <article 
            className={`glass ${feedStyles.feedCard} ${getThemeClass(form.colorTheme)}`}
            style={{ transition: 'all 0.3s' }}
          >
            <div className={feedStyles.cardHeader}>
              <div className={feedStyles.coachMeta}>
                <span className={feedStyles.coachName}>
                  {form.coachName.trim() ? `Coach ${form.coachName}` : 'Coach Phil Jackson'}
                </span>
                <span className={feedStyles.timeAgo}>Just now</span>
              </div>
              <span className={feedStyles.tagPill}>{form.tag}</span>
            </div>
            
            <h2 className={feedStyles.feedTitle}>
              {form.title.trim() ? form.title : 'The Process is More Important Than the Output'}
            </h2>
            <p className={feedStyles.feedContent}>
              {form.content.trim() ? form.content : 'Draft your coaching insights. This card will display exactly how it is styled, colored, and sized in the student stream in real-time.'}
            </p>
            
            <div className={feedStyles.cardFooter}>
              <div className={feedStyles.reactions}>
                <button className={feedStyles.clapButton} disabled style={{ cursor: 'default' }}>
                  <Flame size={18} className={feedStyles.clapIcon} />
                  <span className={feedStyles.clapCount}>0</span>
                </button>
              </div>
            </div>
          </article>
        </aside>
      </div>

      {/* 3. Success Modal Overlay */}
      {showSuccess && (
        <div className={styles.successOverlay}>
          <div className={`glass ${styles.successCard}`}>
            <div className={styles.successIconWrapper}>
              <CheckCircle size={36} />
            </div>
            <h3 className={styles.successTitle}>Broadcast Live!</h3>
            <p className={styles.successText}>
              Your coaching insight was successfully stored in the database, cached in memory, and broadcasted to all connected students!
            </p>
            <div className={styles.actionRow}>
              <Link href="/" className={styles.btnPrimary} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                View in Stream
              </Link>
              <button 
                type="button" 
                className={styles.btnSecondary}
                onClick={handleReset}
              >
                Draft Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
