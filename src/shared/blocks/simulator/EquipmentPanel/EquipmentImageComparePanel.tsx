import type { Equipment } from '@/features/simulator/store/gameTypes';

import { getSimulatorEquipmentArtworkUrl } from '@/shared/lib/simulator-equipment-artwork';
import { getSimulatorDisplayImageUrl } from '@/shared/lib/simulator-image-url';

interface EquipmentImageComparePanelProps {
  equipment: Equipment;
  imagePreview?: string;
  className?: string;
  artworkHeightClassName?: string;
  previewHeightClassName?: string;
}

export function EquipmentImageComparePanel({
  equipment,
  imagePreview,
  className = '',
  artworkHeightClassName = 'h-44',
  previewHeightClassName = 'h-44',
}: EquipmentImageComparePanelProps) {
  const artworkUrl = getSimulatorEquipmentArtworkUrl(
    equipment.type,
    equipment.name
  );
  const uploadedPreviewUrl = getSimulatorDisplayImageUrl(
    imagePreview || equipment.imageUrl
  );

  return (
    <div className={`grid gap-3 md:grid-cols-2 ${className}`}>
      <div className="rounded-lg border border-yellow-800/30 bg-slate-950/40 p-3">
        <div className="mb-2 text-xs font-medium text-slate-400">
          装备展示图
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
          <img
            src={artworkUrl}
            alt={`${equipment.name} 装备展示图`}
            className={`${artworkHeightClassName} w-full object-cover`}
          />
        </div>
      </div>

      <div className="rounded-lg border border-cyan-800/30 bg-cyan-950/10 p-3">
        <div className="mb-2 text-xs font-medium text-cyan-200">OCR 原图</div>
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
          {uploadedPreviewUrl ? (
            <img
              src={uploadedPreviewUrl}
              alt={`${equipment.name} OCR 原图`}
              className={`${previewHeightClassName} w-full object-cover`}
            />
          ) : (
            <div
              className={`${previewHeightClassName} flex items-center justify-center px-4 text-center text-sm text-slate-500`}
            >
              当前没有可对照的 OCR 原图
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
