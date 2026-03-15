'use client';

import dynamic from 'next/dynamic';

const MapCanvas = dynamic(() => import('./MapCanvas'), { ssr: false });

interface ServerSession {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

interface Props {
  serverSession: ServerSession | null;
}

export default function MapCanvasClient({ serverSession }: Props) {
  const handleSignIn = () => {
    window.location.href = '/api/auth/signin/google';
  };

  const handleSignOut = () => {
    window.location.href = '/api/auth/signout';
  };

  return (
    <MapCanvas
      session={serverSession}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
    />
  );
}
