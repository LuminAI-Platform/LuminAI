import * as I from "./iconReexports";

export * from "./iconReexports";

/**
 * Standard icon size scale across LuminAI:
 * - 20px in sidebar and header
 * - 18px in card tiles
 * - 16px in dropdown rows and buttons
 * - 14px inline with small text
 */
export const ICON_SIZES = {
  sidebar: 20,
  header: 20,
  card: 18,
  dropdown: 16,
  button: 16,
  inline: 14,
} as const;

export type IconSizeScale = keyof typeof ICON_SIZES;

/**
 * Global stroke width applied across LuminAI: 2
 */
export const GLOBAL_STROKE_WIDTH = 2;

/**
 * Central concept icon map for LuminAI.
 * Every destination and platform concept has exactly one canonical icon app-wide.
 * No two different destinations may share an icon.
 * Updating an icon here updates it across the entire application.
 */
export const Icons = {
  // Destination & Concept Mapping
  Dashboard: I.LayoutDashboard,
  EntityExplorer: I.ZoomIn,
  KnowledgeGraph: I.Share2,
  DataConnections: I.Plug,
  SchemaStudio: I.TableProperties,
  FusionReview: I.GitMerge,
  PipelineMonitor: I.Activity,
  PipelineExecutions: I.Workflow,
  Wrench: I.Wrench,
  Wand2: I.Wand2,
  OntologyManager: I.Shapes,
  Settings: I.Settings,
  History: I.History,
  DataQuality: I.ShieldCheck,
  ResolvedEntities: I.Network,
  Users: I.Users,
  Tenants: I.Building2,

  // General UI, Controls & Actions
  Search: I.Search,
  Plus: I.Plus,
  Minus: I.Minus,
  RefreshCw: I.RefreshCw,
  Sun: I.Sun,
  Moon: I.Moon,
  Monitor: I.Monitor,
  Bell: I.Bell,
  Check: I.Check,
  CheckCheck: I.CheckCheck,
  CheckCircle: I.CheckCircle,
  CheckCircle2: I.CheckCircle2,
  CheckSquare: I.CheckSquare,
  Square: I.Square,
  MinusSquare: I.MinusSquare,
  AlertCircle: I.AlertCircle,
  AlertTriangle: I.AlertTriangle,
  AlertOctagon: I.AlertOctagon,
  Info: I.Info,
  Trash2: I.Trash2,
  ExternalLink: I.ExternalLink,
  ArrowRight: I.ArrowRight,
  ArrowLeft: I.ArrowLeft,
  ArrowDown: I.ArrowDown,
  ArrowUp: I.ArrowUp,
  ArrowUpRight: I.ArrowUpRight,
  ArrowDownLeft: I.ArrowDownLeft,
  ArrowUpDown: I.ArrowUpDown,
  ChevronDown: I.ChevronDown,
  ChevronUp: I.ChevronUp,
  ChevronLeft: I.ChevronLeft,
  ChevronRight: I.ChevronRight,
  X: I.X,
  Loader2: I.Loader2,
  Copy: I.Copy,
  Eye: I.Eye,
  EyeOff: I.EyeOff,
  Key: I.Key,
  Sliders: I.Sliders,
  Building: I.Building,
  User: I.User,
  LogOut: I.LogOut,
  Download: I.Download,
  Upload: I.Upload,
  FileText: I.FileText,
  FolderOpen: I.FolderOpen,
  FolderDown: I.FolderDown,
  Database: I.Database,
  Table: I.Table,
  Save: I.Save,
  Award: I.Award,
  GitBranch: I.GitBranch,
  GitCommit: I.GitCommit,
  GitCompare: I.GitCompare,
  GitFork: I.GitFork,
  PlusCircle: I.PlusCircle,
  Cpu: I.Cpu,
  Calendar: I.Calendar,
  Clock: I.Clock,
  Tag: I.Tag,
  FilterX: I.FilterX,
  CornerDownLeft: I.CornerDownLeft,
  ZoomOut: I.ZoomOut,
  Maximize2: I.Maximize2,
  RotateCcw: I.RotateCcw,
  MoreVertical: I.MoreVertical,
  MoreHorizontal: I.MoreHorizontal,
  Shield: I.Shield,
  Radio: I.Radio,
  Play: I.Play,
  BarChart3: I.BarChart3,
  Boxes: I.Boxes,
  Layers: I.Layers,
  Compass: I.Compass,
  Home: I.Home,
  PanelLeftClose: I.PanelLeftClose,
  PanelLeftOpen: I.PanelLeftOpen,
  PenLine: I.PenLine,
  Menu: I.Menu,
  XCircle: I.XCircle,
  Sparkles: I.Sparkles,
} as const;

export type IconKey = keyof typeof Icons;

export default Icons;
