import { respErr } from '@/shared/lib/resp';
import {
  getSimulatorEquipmentArtworkAssetPath,
  getSimulatorEquipmentDefaultArtworkAssetPath,
} from '@/shared/lib/simulator-equipment-artwork';

const TYPE_THEME = {
  weapon: {
    title: '武器',
    start: '#7c3aed',
    end: '#312e81',
    accent: '#facc15',
  },
  helmet: {
    title: '头盔',
    start: '#2563eb',
    end: '#0f172a',
    accent: '#fde68a',
  },
  necklace: {
    title: '项链',
    start: '#0f766e',
    end: '#134e4a',
    accent: '#fef08a',
  },
  armor: {
    title: '衣服',
    start: '#7c2d12',
    end: '#431407',
    accent: '#fdba74',
  },
  belt: {
    title: '腰带',
    start: '#92400e',
    end: '#451a03',
    accent: '#fde68a',
  },
  shoes: {
    title: '鞋子',
    start: '#1d4ed8',
    end: '#172554',
    accent: '#bfdbfe',
  },
  trinket: {
    title: '灵饰',
    start: '#a21caf',
    end: '#581c87',
    accent: '#f5d0fe',
  },
  jade: {
    title: '玉魄',
    start: '#0f766e',
    end: '#022c22',
    accent: '#a7f3d0',
  },
  runeStone: {
    title: '符石',
    start: '#334155',
    end: '#0f172a',
    accent: '#e2e8f0',
  },
  rune: {
    title: '符石',
    start: '#334155',
    end: '#0f172a',
    accent: '#e2e8f0',
  },
} as const;

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function splitNameLines(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 4) {
    return [trimmed];
  }

  if (trimmed.length <= 8) {
    return [trimmed.slice(0, 4), trimmed.slice(4)];
  }

  return [trimmed.slice(0, 5), trimmed.slice(5, 10)];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawType = searchParams.get('type')?.trim() ?? '';
  const rawName = searchParams.get('name')?.trim() ?? '';

  if (!rawType) {
    return respErr('missing equipment type');
  }

  const theme = TYPE_THEME[rawType as keyof typeof TYPE_THEME];
  if (!theme) {
    return respErr('unsupported equipment type');
  }

  const matchedAssetPath = getSimulatorEquipmentArtworkAssetPath(
    rawType as keyof typeof TYPE_THEME,
    rawName
  );
  if (matchedAssetPath) {
    return Response.redirect(new URL(matchedAssetPath, req.url), 307);
  }

  const defaultAssetPath = getSimulatorEquipmentDefaultArtworkAssetPath(
    rawType as keyof typeof TYPE_THEME
  );
  if (defaultAssetPath) {
    return Response.redirect(new URL(defaultAssetPath, req.url), 307);
  }

  const displayName = rawName || theme.title;
  const nameLines = splitNameLines(displayName);
  const escapedNameLines = nameLines.map((item) => escapeXml(item));
  const escapedType = escapeXml(theme.title);
  const accent = theme.accent;

  const textBlock = escapedNameLines
    .map(
      (line, index) =>
        `<text x="76" y="${index === 0 ? 108 : 136}" text-anchor="middle" font-size="${
          nameLines.length > 1 ? 22 : 26
        }" font-weight="700" fill="#f8fafc">${line}</text>`
    )
    .join('');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="152" height="152" viewBox="0 0 152 152" fill="none">
      <defs>
        <linearGradient id="bg" x1="20" y1="12" x2="132" y2="140" gradientUnits="userSpaceOnUse">
          <stop stop-color="${theme.start}" />
          <stop offset="1" stop-color="${theme.end}" />
        </linearGradient>
        <linearGradient id="shine" x1="26" y1="18" x2="126" y2="126" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.3" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="152" height="152" rx="24" fill="#020617"/>
      <rect x="4" y="4" width="144" height="144" rx="20" fill="url(#bg)"/>
      <rect x="12" y="12" width="128" height="128" rx="16" fill="url(#shine)" opacity="0.7"/>
      <circle cx="118" cy="36" r="18" fill="${accent}" fill-opacity="0.18"/>
      <circle cx="38" cy="118" r="28" fill="${accent}" fill-opacity="0.14"/>
      <rect x="18" y="18" width="116" height="16" rx="8" fill="rgba(15,23,42,0.5)"/>
      <text x="76" y="29" text-anchor="middle" font-size="11" font-weight="700" fill="${accent}">${escapedType}</text>
      <rect x="24" y="52" width="104" height="64" rx="18" fill="rgba(15,23,42,0.36)" stroke="rgba(248,250,252,0.12)"/>
      ${textBlock}
      <rect x="34" y="123" width="84" height="3" rx="1.5" fill="${accent}" fill-opacity="0.7"/>
    </svg>
  `.trim();

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
