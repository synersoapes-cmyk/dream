import { getNamedIconComponent, getNamedIconFallback } from '@/shared/lib/icon-registry';

export function SmartIcon({
  name,
  size = 24,
  className,
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
  [key: string]: any;
}) {
  const IconComponent = getNamedIconComponent(name);
  const FallbackIcon = getNamedIconFallback(name);

  if (!IconComponent && process.env.NODE_ENV !== 'production') {
    console.warn(`Icon "${name}" is not registered, using fallback`);
  }

  const ResolvedIcon = IconComponent || FallbackIcon;

  return <ResolvedIcon size={size} className={className} {...props} />;
}
