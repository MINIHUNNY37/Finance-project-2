import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function buildCorsResponse(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '*';
  const requestHeaders = request.headers.get('access-control-request-headers');

  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.headers.set('Access-Control-Max-Age', '86400');
  response.headers.set('Vary', 'Origin');

  if (requestHeaders) {
    response.headers.set('Access-Control-Allow-Headers', requestHeaders);
  }

  return response;
}

export function proxy(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return buildCorsResponse(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
