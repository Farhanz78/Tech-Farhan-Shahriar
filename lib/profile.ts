import { supabase } from '@/utils/supabase/client';
import type { Profile } from '@/types';

/** Shown when a profile field has not been filled in from the admin panel yet. */
export const FALLBACK = {
  name: 'Farhan Shahriar',
  tagline: 'Full-Stack Developer',
  bio:
    'I design and build complete products end to end — web applications, ' +
    'Android apps, 3D browser games and the tools around them. One person from ' +
    'the first sketch to the deployed build, so nothing gets lost between ' +
    'designer, developer and whoever ships it.',
  email: 'ftamim440@gmail.com',
  phone: '01945523411',
};

export async function getProfile(): Promise<Profile | null> {
  // NOT .single(): more than one row can carry role='admin', and .single()
  // errors on multiple rows, which silently discards the whole profile.
  const { data } = await supabase.from('profiles').select('*').eq('role', 'admin');
  if (!data?.length) return null;
  return (data.find((p) => p.full_name) ?? data[0]) as Profile;
}

export function resolveProfile(profile: Profile | null) {
  return {
    name: profile?.full_name || FALLBACK.name,
    tagline: profile?.tagline || FALLBACK.tagline,
    bio: profile?.bio || FALLBACK.bio,
    email: profile?.email || FALLBACK.email,
    phone: profile?.phone || FALLBACK.phone,
    fiverr: profile?.fiverr_url || '',
    avatar: profile?.avatar_url || '',
    location: profile?.location || '',
    skills: profile?.skills?.length
      ? profile.skills
      : ['React', 'Next.js', 'TypeScript', 'Three.js', 'Android', 'Supabase'],
  };
}

/**
 * Bangladeshi numbers are stored locally ("01945523411") but most enquiries come
 * from abroad, and an overseas client cannot dial the local form.
 */
export function formatPhone(raw: string): { display: string; href: string } {
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^01\d{9}$/.test(digits)) {
    const national = digits.slice(1);
    return {
      display: `+880 ${national.slice(0, 4)}-${national.slice(4)}`,
      href: `tel:+880${national}`,
    };
  }
  return { display: raw, href: `tel:${digits}` };
}
