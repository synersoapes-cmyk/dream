import type { Equipment } from '@/features/simulator/store/gameTypes';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/shared/components/ui/hover-card';
import {
  getSimulatorEquipmentArtworkUrl,
  getSimulatorEquipmentDisplayImageUrl,
} from '@/shared/lib/simulator-equipment-artwork';
import { getSimulatorDisplayImageUrl } from '@/shared/lib/simulator-image-url';

interface EquipmentImageProps {
  equipment: Equipment;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  preferArtwork?: boolean;
  showHoverCompare?: boolean;
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
  preferArtwork = true,
  showHoverCompare = true,
}: EquipmentImageProps) {
  const uploadedPreviewUrl = getSimulatorDisplayImageUrl(equipment.imageUrl);
  const artworkUrl = getSimulatorEquipmentArtworkUrl(
    equipment.type,
    equipment.name
  );
  const displayUrl = preferArtwork
    ? getSimulatorEquipmentDisplayImageUrl(equipment)
    : uploadedPreviewUrl || artworkUrl;
  const shouldShowHoverCompare =
    showHoverCompare &&
    Boolean(uploadedPreviewUrl) &&
    uploadedPreviewUrl !== displayUrl;

  const imageNode = (
    <div
      className={`${sizeClasses[size]} shrink-0 overflow-hidden rounded-lg border border-yellow-800/30 bg-slate-950/50 ${className}`}
    >
      <img
        src={displayUrl}
        alt={equipment.name}
        className="h-full w-full object-cover"
      />
    </div>
  );

  if (!shouldShowHoverCompare || !uploadedPreviewUrl) {
    return imageNode;
  }

  return (
    <HoverCard openDelay={180}>
      <HoverCardTrigger asChild>{imageNode}</HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-[320px] border-yellow-700/50 bg-slate-950/95 p-3 text-slate-100"
      >
        <div className="mb-2 text-xs font-medium text-yellow-300">
          装备图与 OCR 原图对比
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-[11px] text-slate-400">当前展示</div>
            <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
              <img
                src={displayUrl}
                alt={`${equipment.name} 展示图`}
                className="h-32 w-full object-cover"
              />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-slate-400">上传截图</div>
            <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
              <img
                src={uploadedPreviewUrl}
                alt={`${equipment.name} OCR 原图`}
                className="h-32 w-full object-cover"
              />
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
