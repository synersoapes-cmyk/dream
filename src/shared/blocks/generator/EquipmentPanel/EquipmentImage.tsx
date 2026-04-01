// @ts-nocheck
import type { Equipment } from '@/features/simulator/store/gameTypes';

// 获取装备默认图片
const getEquipmentDefaultImage = (type: Equipment['type']): string => {
  const defaultImages: Record<string, string> = {
    weapon: 'https://images.unsplash.com/photo-1668007470566-bd1e18d05fe6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    helmet: 'https://images.unsplash.com/photo-1720463876770-f578e7eb5f73?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    necklace: 'https://images.unsplash.com/photo-1767921482419-d2d255b5b700?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    armor: 'https://images.unsplash.com/photo-1773216344170-7fca0c1f83ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    belt: 'https://images.unsplash.com/photo-1734383524180-3c6f9b21e8e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    shoes: 'https://images.unsplash.com/photo-1759779790885-fc5c0e0ae240?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    trinket: 'https://images.unsplash.com/photo-1594399429595-7f0028532614?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    jade: 'https://images.unsplash.com/photo-1662434921965-3b71f180c6f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    runeStone: 'https://images.unsplash.com/photo-1662434921965-3b71f180c6f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    rune: 'https://images.unsplash.com/photo-1662434921965-3b71f180c6f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
  };
  return defaultImages[type] || defaultImages.weapon;
};

interface EquipmentImageProps {
  equipment: Equipment;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function EquipmentImage({ equipment, size = 'md', className = '' }: EquipmentImageProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-lg overflow-hidden bg-slate-950/50 border border-yellow-800/30 shrink-0 ${className}`}>
      <img 
        src={equipment.imageUrl || getEquipmentDefaultImage(equipment.type)} 
        alt={equipment.name}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
