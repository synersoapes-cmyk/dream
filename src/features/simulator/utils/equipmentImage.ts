import type { SimulatorEquipmentType } from '@/shared/lib/simulator-equipment';

// 获取装备默认图片
export function getEquipmentDefaultImage(type: SimulatorEquipmentType): string {
  const defaultImages: Record<SimulatorEquipmentType, string> = {
    weapon:
      'https://images.unsplash.com/photo-1668007470566-bd1e18d05fe6?w=200',
    helmet:
      'https://images.unsplash.com/photo-1720463876770-f578e7eb5f73?w=200',
    necklace:
      'https://images.unsplash.com/photo-1767921482419-d2d255b5b700?w=200',
    armor: 'https://images.unsplash.com/photo-1773216344170-7fca0c1f83ea?w=200',
    belt: 'https://images.unsplash.com/photo-1734383524180-3c6f9b21e8e3?w=200',
    shoes: 'https://images.unsplash.com/photo-1759779790885-fc5c0e0ae240?w=200',
    trinket:
      'https://images.unsplash.com/photo-1594399429595-7f0028532614?w=200',
    jade: 'https://images.unsplash.com/photo-1662434921965-3b71f180c6f4?w=200',
    runeStone:
      'https://images.unsplash.com/photo-1662434921965-3b71f180c6f4?w=200',
    rune: 'https://images.unsplash.com/photo-1662434921965-3b71f180c6f4?w=200',
  };
  return defaultImages[type] || defaultImages.weapon;
}
