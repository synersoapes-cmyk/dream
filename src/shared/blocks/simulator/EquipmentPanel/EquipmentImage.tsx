import type { Equipment } from '@/features/simulator/store/gameTypes';
import { getEquipmentDefaultImage } from '@/features/simulator/utils/equipmentImage';

interface EquipmentImageProps {
  equipment: Equipment;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses: Record<NonNullable<EquipmentImageProps['size']>, string> = {
  sm: 'w-8 h-8',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-24 h-24',
};

export function EquipmentImage({
  equipment,
  size = 'md',
  className = '',
}: EquipmentImageProps) {
  return (
    <div
      className={`${sizeClasses[size]} shrink-0 overflow-hidden rounded-lg border border-yellow-800/30 bg-slate-950/50 ${className}`}
    >
      <img
        src={equipment.imageUrl || getEquipmentDefaultImage(equipment.type)}
        alt={equipment.name}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
