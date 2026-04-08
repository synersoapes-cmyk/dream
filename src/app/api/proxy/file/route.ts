import { NextRequest, NextResponse } from 'next/server';

import { getAllConfigs } from '@/shared/models/config';

function stripSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, '');
}

function buildR2ObjectUrl(key: string, configs: Awaited<ReturnType<typeof getAllConfigs>>) {
  const bucket = stripSlashes(configs.r2_bucket_name || '');
  const uploadPath = stripSlashes(configs.r2_upload_path || 'uploads');
  const normalizedKey = stripSlashes(key);
  const endpoint =
    configs.r2_endpoint ||
    (configs.r2_account_id
      ? `https://${configs.r2_account_id}.r2.cloudflarestorage.com`
      : '');

  if (!bucket || !endpoint || !normalizedKey) {
    return null;
  }

  const keyPath = normalizedKey.startsWith(`${uploadPath}/`)
    ? normalizedKey
    : `${uploadPath}/${normalizedKey}`;

  return `${endpoint.replace(/\/+$/, '')}/${bucket}/${keyPath}`;
}

function isCloudflareR2Url(url: string) {
  try {
    return new URL(url).hostname.endsWith('.r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}

async function fetchFromR2WithCredentials(
  url: string,
  configs: Awaited<ReturnType<typeof getAllConfigs>>
) {
  if (!configs.r2_access_key || !configs.r2_secret_key) {
    throw new Error('R2 credentials are not configured');
  }

  const { AwsClient } = await import('aws4fetch');
  const client = new AwsClient({
    accessKeyId: configs.r2_access_key,
    secretAccessKey: configs.r2_secret_key,
    region: 'auto',
  });

  return client.fetch(
    new Request(url, {
      method: 'GET',
    })
  );
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const key = req.nextUrl.searchParams.get('key');

  if (!url && !key) {
    return new NextResponse('Missing url or key parameter', { status: 400 });
  }

  try {
    const configs = await getAllConfigs();
    const targetUrl = key ? buildR2ObjectUrl(key, configs) : url;

    if (!targetUrl) {
      return new NextResponse('Invalid R2 object reference', { status: 400 });
    }

    const response =
      key || isCloudflareR2Url(targetUrl)
        ? await fetchFromR2WithCredentials(targetUrl, configs)
        : await fetch(targetUrl);

    if (!response.ok) {
      return new NextResponse(`Failed to fetch file: ${response.statusText}`, {
        status: response.status,
      });
    }

    const headers = new Headers();
    headers.set(
      'Content-Type',
      response.headers.get('content-type') || 'application/octet-stream'
    );

    const cacheControl = response.headers.get('cache-control');
    if (cacheControl) {
      headers.set('Cache-Control', cacheControl);
    }

    return new NextResponse(response.body, {
      headers,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
