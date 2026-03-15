'use client';

import dynamic from 'next/dynamic';
import { signIn, signOut } from 'next-auth/react';

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
  const handleSignIn = () => signIn('google', { callbackUrl: '/' });
  const handleSignOut = () => signOut({ callbackUrl: '/' });

  return (
    <MapCanvas
      session={serverSession}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
    />
  );
}

