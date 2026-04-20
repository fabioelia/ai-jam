import { useState } from 'react';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'common' | 'authentication' | 'data' | 'ui' | 'api';
  prompts: string[];
  suggestedTickets: {
    title: string;
    priority: string;
    description: string;
  }[];
}

const TEMPLATES: Template[] = [
  {
    id: 'user-auth',
    name: 'User Authentication',
    description: 'Complete user registration, login, and profile management',
    icon: '🔐',
    category: 'authentication',
    prompts: [
      'Implement user registration with email verification',
      'Add password reset functionality',
      'Create user profile management',
      'Add social login options (Google, GitHub)',
      'Implement two-factor authentication'
    ],
    suggestedTickets: [
      {
        title: 'User Registration API',
        priority: 'high',
        description: 'Create REST API endpoints for user registration with email validation'
      },
      {
        title: 'Login System',
        priority: 'high',
        description: 'Implement secure login with JWT token management'
      },
      {
        title: 'Password Reset',
        priority: 'medium',
        description: 'Add forgot password flow with email token verification'
      },
      {
        title: 'User Profile CRUD',
        priority: 'medium',
        description: 'Create profile management endpoints and UI components'
      }
    ]
  },
  {
    id: 'dashboard-analytics',
    name: 'Dashboard & Analytics',
    description: 'Interactive dashboards with charts, metrics, and data visualization',
    icon: '📊',
    category: 'common',
    prompts: [
      'Create analytics dashboard with key metrics',
      'Add interactive charts and graphs',
      'Implement data filtering and export',
      'Add real-time data updates',
      'Create custom report builder'
    ],
    suggestedTickets: [
      {
        title: 'Dashboard Layout',
        priority: 'high',
        description: 'Design responsive dashboard layout with widget system'
      },
      {
        title: 'Chart Components',
        priority: 'high',
        description: 'Build reusable chart components (line, bar, pie charts)'
      },
      {
        title: 'Data API Integration',
        priority: 'medium',
        description: 'Connect dashboard to analytics data sources'
      }
    ]
  },
  {
    id: 'crud-operations',
    name: 'CRUD Operations',
    description: 'Standard create, read, update, delete functionality for resources',
    icon: '📝',
    category: 'data',
    prompts: [
      'Create database schema for resources',
      'Implement REST API CRUD endpoints',
      'Build list view with pagination',
      'Add create/edit forms',
      'Implement bulk actions and filters'
    ],
    suggestedTickets: [
      {
        title: 'Database Schema',
        priority: 'high',
        description: 'Define database tables and relationships for resources'
      },
      {
        title: 'API Endpoints',
        priority: 'high',
        description: 'Create CRUD API endpoints with validation'
      },
      {
        title: 'List View Component',
        priority: 'medium',
        description: 'Build responsive table with sorting and pagination'
      },
      {
        title: 'Form Components',
        priority: 'medium',
        description: 'Create reusable form components with validation'
      }
    ]
  },
  {
    id: 'api-integration',
    name: 'API Integration',
    description: 'Third-party service integrations and webhook handling',
    icon: '🔗',
    category: 'api',
    prompts: [
      'Integrate with external API service',
      'Implement webhook receiver',
      'Add API rate limiting and caching',
      'Create error handling and retry logic',
      'Build API testing interface'
    ],
    suggestedTickets: [
      {
        title: 'API Client Setup',
        priority: 'high',
        description: 'Configure API client with authentication'
      },
      {
        title: 'Webhook Handler',
        priority: 'high',
        description: 'Implement webhook receiver with signature verification'
      },
      {
        title: 'Rate Limiting',
        priority: 'medium',
        description: 'Add API rate limiting and request queuing'
      }
    ]
  },
  {
    id: 'real-time-features',
    name: 'Real-time Features',
    description: 'WebSocket, live updates, and collaborative features',
    icon: '⚡',
    category: 'common',
    prompts: [
      'Implement WebSocket connection',
      'Add real-time notifications',
      'Create collaborative editing',
      'Build live activity feed',
      'Add presence indicators'
    ],
    suggestedTickets: [
      {
        title: 'WebSocket Server',
        priority: 'high',
        description: 'Set up WebSocket server with authentication'
      },
      {
        title: 'Notification System',
        priority: 'high',
        description: 'Build real-time notification delivery'
      },
      {
        title: 'Activity Feed',
        priority: 'medium',
        description: 'Create live activity feed component'
      }
    ]
  },
  {
    id: 'file-upload',
    name: 'File Upload & Storage',
    description: 'File upload, storage, and media management',
    icon: '📁',
    category: 'data',
    prompts: [
      'Implement file upload with drag & drop',
      'Add image preview and optimization',
      'Integrate cloud storage (S3)',
      'Build file manager UI',
      'Add virus scanning'
    ],
    suggestedTickets: [
      {
        title: 'Upload Component',
        priority: 'high',
        description: 'Create drag-and-drop file upload component'
      },
      {
        title: 'Storage Integration',
        priority: 'high',
        description: 'Configure cloud storage (S3, Cloudinary)'
      },
      {
        title: 'File Manager',
        priority: 'medium',
        description: 'Build file management interface with organization'
      }
    ]
  },
  {
    id: 'mobile-responsive',
    name: 'Mobile Responsive',
    description: 'Mobile-first design and responsive layout components',
    icon: '📱',
    category: 'ui',
    prompts: [
      'Design mobile-first layouts',
      'Create responsive components',
      'Add touch gestures',
      'Implement offline support',
      'Optimize performance for mobile'
    ],
    suggestedTickets: [
      {
        title: 'Responsive Layout',
        priority: 'high',
        description: 'Implement mobile-first responsive design system'
      },
      {
        title: 'Touch Components',
        priority: 'medium',
        description: 'Add touch-friendly interactive components'
      },
      {
        title: 'Performance Optimization',
        priority: 'medium',
        description: 'Optimize assets and loading for mobile devices'
      }
    ]
  },
  {
    id: 'search-filters',
    name: 'Search & Filters',
    description: 'Advanced search with filters, sorting, and results',
    icon: '🔍',
    category: 'common',
    prompts: [
      'Implement full-text search',
      'Add advanced filters',
      'Create search suggestions',
      'Build result highlighting',
      'Add saved searches'
    ],
    suggestedTickets: [
      {
        title: 'Search Engine',
        priority: 'high',
        description: 'Implement full-text search with indexing'
      },
      {
        title: 'Filter UI',
        priority: 'high',
        description: 'Build advanced filter interface'
      },
      {
        title: 'Search Suggestions',
        priority: 'medium',
        description: 'Add autocomplete and search suggestions'
      }
    ]
  }
];

const CATEGORIES = {
  common: 'Common',
  authentication: 'Authentication',
  data: 'Data & Storage',
  ui: 'UI Components',
  api: 'API Integration'
} as const;

interface ProposalTemplatesProps {
  onSelectTemplate: (template: Template) => void;
  onSelectPrompt: (prompt: string) => void;
}

export default function ProposalTemplates({ onSelectTemplate, onSelectPrompt }: ProposalTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const filteredTemplates = selectedCategory === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === selectedCategory);

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            selectedCategory === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          All Templates
        </button>
        {Object.entries(CATEGORIES).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              selectedCategory === key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => {
              setSelectedTemplate(template);
              onSelectTemplate(template);
            }}
            className={`text-left p-4 rounded-xl border transition-all duration-200 ${
              selectedTemplate?.id === template.id
                ? 'border-indigo-500 bg-indigo-600/10 shadow-lg shadow-indigo-500/10'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800 hover:shadow-md'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{template.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">{template.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2">{template.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-600">{template.prompts.length} prompts</span>
                  <span className="text-gray-700">•</span>
                  <span className="text-xs text-gray-600">{template.suggestedTickets.length} tickets</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selected template details */}
      {selectedTemplate && (
        <div className="mt-4 p-4 rounded-xl border border-gray-700 bg-gray-800/50 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">{selectedTemplate.icon}</span>
            <div>
              <h3 className="text-base font-semibold text-white">{selectedTemplate.name}</h3>
              <p className="text-xs text-gray-500">{selectedTemplate.description}</p>
            </div>
          </div>

          {/* Quick start prompts */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Start Prompts
            </h4>
            <div className="space-y-2">
              {selectedTemplate.prompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectPrompt(prompt)}
                  className="w-full text-left p-3 rounded-lg bg-gray-900/50 border border-gray-700 hover:border-indigo-500 hover:bg-gray-900 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 group-hover:text-indigo-400">#{idx + 1}</span>
                    <span className="text-sm text-gray-300 group-hover:text-white">{prompt}</span>
                    <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-indigo-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Suggested tickets */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Suggested Tickets
            </h4>
            <div className="space-y-2">
              {selectedTemplate.suggestedTickets.map((ticket, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-gray-900/30 border border-gray-700/50">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                      ticket.priority === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {ticket.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-sm font-medium text-white">{ticket.title}</h5>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ticket.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { TEMPLATES };
export type { Template };
