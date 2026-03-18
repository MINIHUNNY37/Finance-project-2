import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ADMIN_EMAILS = ['minjune043010@gmail.com'];

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET || 'dev-secret-please-set-NEXTAUTH_SECRET-in-env',
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return true;
      try {
        await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name ?? undefined, image: user.image ?? undefined, lastLogin: new Date() },
          create: {
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            role: ADMIN_EMAILS.includes(user.email) ? 'admin' : 'user',
            lastLogin: new Date(),
          },
        });
      } catch (err) {
        console.error('Failed to upsert user', err);
      }
      return true;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
