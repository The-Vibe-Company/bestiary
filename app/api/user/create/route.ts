import { prisma } from '@/lib/prisma';
import { neonAuth } from '@neondatabase/auth/next/server';

export async function POST(request: Request) {
  const { session } = await neonAuth();

  if (!session) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { username, email } = await request.json();

  if (!username || !email) {
    return new Response(JSON.stringify({ error: 'Username et email requis' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const createdUser = await prisma.user.create({
      data: {
        id: session.userId,
        email,
        username,
      },
    });

    return new Response(JSON.stringify({ user: createdUser }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return new Response(JSON.stringify({ error: 'Erreur création utilisateur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
