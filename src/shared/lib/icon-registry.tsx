import { createElement, type ComponentType } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  BookOpenText,
  Box,
  Brain,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  FlaskConical,
  Folder,
  Github,
  HelpCircle,
  History,
  Home,
  Key,
  Mail,
  Menu,
  MessageCircle,
  Newspaper,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Zap,
} from 'lucide-react';
import {
  RiAddLine,
  RiBarChart2Line,
  RiChat2Line,
  RiClapperboardAiLine,
  RiCloudy2Fill,
  RiCloudyFill,
  RiCodeFill,
  RiDatabase2Line,
  RiDeleteBinLine,
  RiDiscordFill,
  RiEditLine,
  RiEyeLine,
  RiFlashlightFill,
  RiImage2Line,
  RiKey2Fill,
  RiKeyLine,
  RiLockPasswordLine,
  RiMessage2Line,
  RiMusic2Line,
  RiNextjsFill,
  RiQuestionLine,
  RiRefreshLine,
  RiRobot2Line,
  RiTaskLine,
  RiTwitterXFill,
  RiVideoLine,
} from 'react-icons/ri';

type IconComponent = ComponentType<any>;

const ICON_REGISTRY: Record<string, IconComponent> = {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  BookOpenText,
  Box,
  Brain,
  Clock,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  FlaskConical,
  Folder,
  Github,
  HelpCircle,
  History,
  Home,
  Key,
  Mail,
  Menu,
  MessageCircle,
  Newspaper,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Zap,
  RiAddLine,
  RiBarChart2Line,
  RiChat2Line,
  RiClapperboardAiLine,
  RiCloudy2Fill,
  RiCloudyFill,
  RiCodeFill,
  RiDatabase2Line,
  RiDeleteBinLine,
  RiDiscordFill,
  RiEditLine,
  RiEyeLine,
  RiFlashlightFill,
  RiImage2Line,
  RiKey2Fill,
  RiKeyLine,
  RiLockPasswordLine,
  RiMessage2Line,
  RiMusic2Line,
  RiNextjsFill,
  RiQuestionLine,
  RiRefreshLine,
  RiRobot2Line,
  RiTaskLine,
  RiTwitterXFill,
  RiVideoLine,
};

export function getNamedIconComponent(name?: string | null) {
  if (!name) {
    return null;
  }

  return ICON_REGISTRY[name] || null;
}

export function getNamedIconFallback(name?: string | null) {
  if (name?.startsWith('Ri')) {
    return RiQuestionLine;
  }

  return HelpCircle;
}

export function renderNamedIcon(
  name?: string | null,
  props?: Record<string, unknown>
) {
  const Icon = getNamedIconComponent(name) || getNamedIconFallback(name);
  return createElement(Icon, props);
}
