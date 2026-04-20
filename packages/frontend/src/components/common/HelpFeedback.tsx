import { useState, useCallback, useEffect } from 'react';
import { ReactNode } from 'react';

interface HelpFeedbackProps {
  articleId: string;
  articleTitle: string;
  onSubmit: (feedback: FeedbackData) => void;
  showByDefault?: boolean;
  position?: 'top' | 'bottom';
}

interface FeedbackData {
  articleId: string;
  rating: number;
  helpful: boolean | null;
  comment: string;
  timestamp: number;
}

interface FeedbackStats {
  total: number;
  helpful: number;
  notHelpful: number;
  averageRating: number;
  comments: number;
}

// Local storage key for feedback
const FEEDBACK_STORAGE_KEY = 'ai-jam:help-feedback';
const FEEDBACK_STATS_KEY = 'ai-jam:help-feedback-stats';

// Hook to manage feedback
export function useHelpFeedback() {
  const [feedback, setFeedback] = useState<Map<string, FeedbackData>>(new Map());
  const [stats, setStats] = useState<Map<string, FeedbackStats>>(new Map());

  // Load feedback from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFeedback(new Map(Object.entries(parsed)));
      }

      const savedStats = localStorage.getItem(FEEDBACK_STATS_KEY);
      if (savedStats) {
        const parsed = JSON.parse(savedStats);
        setStats(new Map(Object.entries(parsed)));
      }
    } catch (e) {
      console.error('Failed to load feedback:', e);
    }
  }, []);

  const submitFeedback = useCallback((data: FeedbackData) => {
    // Store individual feedback
    setFeedback((prev) => {
      const next = new Map(prev);
      next.set(data.articleId, data);
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(Object.fromEntries(next)));
      return next;
    });

    // Update stats
    setStats((prev) => {
      const currentStats = prev.get(data.articleId) || {
        total: 0,
        helpful: 0,
        notHelpful: 0,
        averageRating: 0,
        comments: 0,
      };

      const newStats = {
        total: currentStats.total + 1,
        helpful: currentStats.helpful + (data.helpful === true ? 1 : 0),
        notHelpful: currentStats.notHelpful + (data.helpful === false ? 1 : 0),
        averageRating: data.rating > 0
          ? (currentStats.averageRating * currentStats.total + data.rating) / (currentStats.total + 1)
          : currentStats.averageRating,
        comments: data.comment.trim() ? currentStats.comments + 1 : currentStats.comments,
      };

      const next = new Map(prev);
      next.set(data.articleId, newStats);
      localStorage.setItem(FEEDBACK_STATS_KEY, JSON.stringify(Object.fromEntries(next)));
      return next;
    });
  }, []);

  const hasFeedback = useCallback((articleId: string) => {
    return feedback.has(articleId);
  }, [feedback]);

  const getFeedback = useCallback((articleId: string) => {
    return feedback.get(articleId);
  }, [feedback]);

  const getStats = useCallback((articleId: string) => {
    return stats.get(articleId) || {
      total: 0,
      helpful: 0,
      notHelpful: 0,
      averageRating: 0,
      comments: 0,
    };
  }, [stats]);

  const clearFeedback = useCallback((articleId?: string) => {
    if (articleId) {
      setFeedback((prev) => {
        const next = new Map(prev);
        next.delete(articleId);
        localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(Object.fromEntries(next)));
        return next;
      });
    } else {
      setFeedback(new Map());
      localStorage.removeItem(FEEDBACK_STORAGE_KEY);
    }
  }, []);

  return {
    submitFeedback,
    hasFeedback,
    getFeedback,
    getStats,
    clearFeedback,
  };
}

// Feedback form component
export default function HelpFeedback({
  articleId,
  articleTitle,
  onSubmit,
  showByDefault = false,
  position = 'bottom',
}: HelpFeedbackProps) {
  const [isOpen, setIsOpen] = useState(showByDefault);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { hasFeedback, getStats } = useHelpFeedback();

  const stats = getStats(articleId);
  const hasUserFeedback = hasFeedback(articleId);

  const handleSubmit = useCallback(() => {
    const feedbackData: FeedbackData = {
      articleId,
      rating,
      helpful,
      comment,
      timestamp: Date.now(),
    };

    onSubmit(feedbackData);
    setIsSubmitted(true);

    // Auto-close after 3 seconds
    setTimeout(() => {
      setIsOpen(false);
    }, 3000);
  }, [articleId, rating, helpful, comment, onSubmit]);

  const handleReset = useCallback(() => {
    setRating(0);
    setHoverRating(0);
    setHelpful(null);
    setComment('');
    setIsSubmitted(false);
  }, []);

  if (isSubmitted) {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  if (!isOpen && !hasUserFeedback) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-gray-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Give feedback
      </button>
    );
  }

  return (
    <div className="border-t border-gray-800 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">Was this helpful?</h4>
        {stats.total > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{stats.helpful} found helpful</span>
            <span>•</span>
            <span>Rating: {stats.averageRating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {!hasUserFeedback ? (
        <div className="space-y-4">
          {/* Rating stars */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-lg transition-transform hover:scale-110 active:scale-95"
                aria-label={`Rate ${star} stars`}
              >
                <svg
                  className={`w-5 h-5 ${
                    star <= (hoverRating || rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-600'
                  }`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
            {rating > 0 && (
              <span className="text-xs text-gray-400 ml-2">{rating}/5</span>
            )}
          </div>

          {/* Helpful/Not helpful */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHelpful(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                helpful === true
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              Yes
            </button>
            <button
              onClick={() => setHelpful(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                helpful === false
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
              No
            </button>
          </div>

          {/* Comment input */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more about your experience..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none"
            rows={2}
          />

          {/* Submit button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                handleReset();
                setIsOpen(false);
              }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!rating && helpful === null}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <p className="text-sm text-gray-400">Thanks for your feedback!</p>
          <button
            onClick={handleReset}
            className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 transition-colors"
          >
            Update your feedback
          </button>
        </div>
      )}
    </div>
  );
}

// Quick helpful/not helpful component
export function QuickHelpful({ articleId, onVote }: { articleId: string; onVote?: (helpful: boolean) => void }) {
  const [voted, setVoted] = useState<boolean | null>(null);
  const { submitFeedback } = useHelpFeedback();

  const handleVote = useCallback(
    (helpful: boolean) => {
      if (voted !== null) return;

      setVoted(helpful);
      submitFeedback({
        articleId,
        rating: helpful ? 5 : 1,
        helpful,
        comment: '',
        timestamp: Date.now(),
      });
      onVote?.(helpful);
    },
    [articleId, voted, submitFeedback, onVote]
  );

  if (voted !== null) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">Thanks for your feedback!</span>
        <button
          onClick={() => setVoted(null)}
          className="text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Was this helpful?</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleVote(true)}
          className={`px-2 py-1 rounded text-xs transition-all ${
            voted === true
              ? 'bg-green-500/20 text-green-400'
              : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => handleVote(false)}
          className={`px-2 py-1 rounded text-xs transition-all ${
            voted === false
              ? 'bg-red-500/20 text-red-400'
              : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}

// Rating display component
export function RatingDisplay({ rating, count, interactive, onRate }: {
  rating: number;
  count?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= (hoverRating || rating);

          if (interactive) {
            return (
              <button
                key={star}
                onClick={() => onRate?.(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-lg transition-transform hover:scale-110 active:scale-95"
                aria-label={`Rate ${star} stars`}
              >
                <svg
                  className={`w-4 h-4 ${
                    isFilled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
                  }`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            );
          }

          return (
            <svg
              key={star}
              className={`w-4 h-4 ${isFilled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          );
        })}
      </div>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-gray-500">({count})</span>
      )}
    </div>
  );
}
