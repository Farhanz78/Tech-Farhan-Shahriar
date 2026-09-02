import Link from 'next/link';
import * as icons from 'lucide-react';
import HeroCanvas from '@/components/HeroCanvas';
import ContactForm from '@/components/ContactForm';
import PhotoCarousel from '@/components/PhotoCarousel';
import Magnetic from '@/components/Magnetic';
import { SiteHeader, SiteFooter, SectionHead } from '@/components/SiteChrome';
import { getProfile, resolveProfile, formatPhone } from '@/lib/profile';
import { supabase } from '@/utils/supabase/client';

export const dynamic = 'force-dynamic';

/**
 * The landing page is about the PERSON, not the portfolio grid. A visitor
 * arriving cold needs to know who he is and what he can be hired for before
 * being shown a wall of thumbnails. The work lives at /work behind a clear
 * invitation.
 */
export default async function Home() {
  const [profile, { count }] = await Promise.all([
    getProfile(),
    supabase.from('tools').select('id', { count: 'exact', head: true }),
  ]);

  const p = resolveProfile(profile);
  const phone = formatPhone(p.phone);
  const projectCount = count ?? 0;
  // Falls back to the profile photo so the carousel is never an empty box
  // before any gallery images have been uploaded.
  const gallery = profile?.gallery?.length ? profile.gallery : p.avatar ? [p.avatar] : [];

  return (
    <div className="min-h-screen bg-ink text-text">
      <SiteHeader name={p.name} />

      {/* ------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <HeroCanvas />

        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-36">
          <div className="max-w-3xl animate-rise">
            {/* No portrait here on purpose — the photos live in the stacked
                carousel above the About section instead. */}
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/70 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-lime backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" />
              Available for new projects
            </p>

            <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl">
              {p.name}
            </h1>

            <p className="mt-4 font-display text-2xl font-bold text-lime md:text-3xl">
              {p.tagline}
            </p>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{p.bio}</p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link
                  href="/work"
                  className="group/cta inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-3.5 font-semibold text-ink shadow-[0_0_0_0_rgba(196,248,42,0.5)] transition-[background-color,box-shadow] duration-300 hover:bg-lime-dim hover:shadow-[0_0_28px_2px_rgba(196,248,42,0.28)]"
                >
                  See my work
                  <icons.ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover/cta:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </Magnetic>
              <Magnetic strength={0.2}>
                <Link
                  href="#contact"
                  className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface/60 px-6 py-3.5 font-semibold backdrop-blur-sm transition-colors duration-300 hover:border-lime/50 hover:text-lime"
                >
                  Start a project
                </Link>
              </Magnetic>
            </div>

            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
              <Stat value={String(projectCount)} label="Projects shipped" />
              <Stat value="4" label="Platforms covered" />
              <Stat value="End to end" label="Design to deployment" />
            </dl>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- services */}
      <section id="services" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <SectionHead
          eyebrow="What I do"
          title="Hire me for"
          sub="Four things I build well, and what you actually receive at the end of each."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Service
            icon={<icons.Globe className="h-5 w-5" />}
            title="Web development"
            promise="Fast, responsive sites and web apps that work on every screen."
            points={['Next.js & React builds', 'Databases and admin panels', 'SEO and performance work', 'Deployed and handed over']}
          />
          <Service
            icon={<icons.Smartphone className="h-5 w-5" />}
            title="Android apps"
            promise="Play Store ready builds, from the first screen to the signed release."
            points={['Signed AAB / APK', 'In-app purchases and ads', 'Store listing assets', 'Tested on real devices']}
          />
          <Service
            icon={<icons.Gamepad2 className="h-5 w-5" />}
            title="2D & 3D games"
            promise="Browser and mobile games that hold a smooth frame rate on a phone."
            points={['HTML5 / WebGL / Three.js', 'Endless runners, racing, arcade', 'Ad and shop systems', 'Full source code included']}
          />
          <Service
            icon={<icons.Wrench className="h-5 w-5" />}
            title="Tools & automation"
            promise="Small focused software that removes a repetitive job."
            points={['Dashboards and calculators', 'Data processing scripts', 'Internal tools', 'Documented so you can run it']}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------ about */}
      <section id="about" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        {gallery.length > 0 && (
          <div className="mx-auto mb-14 max-w-xl">
            <PhotoCarousel photos={gallery} alt={p.name} />
          </div>
        )}

        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <SectionHead eyebrow="About" title={`Who you'd be working with`} />
            <div className="max-w-2xl space-y-4 text-muted">
              <p className="leading-relaxed">{p.bio}</p>
              <p className="leading-relaxed">
                I work solo, which means you talk to the person actually writing the code. No
                account manager in the middle, no brief getting lost on its way to a developer.
                You get progress you can look at, and a build you can run yourself before it
                ships.
              </p>
              <p className="leading-relaxed">
                Everything I put in front of a client is finished work: tested on real devices,
                documented, and handed over with the source so you are never locked in.
              </p>
            </div>

            {p.location && (
              <p className="mt-6 flex items-center gap-2 text-sm text-subtle">
                <icons.MapPin className="h-4 w-4" aria-hidden />
                {p.location}
              </p>
            )}
          </div>

          <div className="lg:pt-[4.5rem]">
            <div className="rounded-2xl border border-hairline bg-surface p-6">
              <p className="mb-4 text-xs uppercase tracking-[0.12em] text-subtle">
                Areas of Expertise
              </p>
              <div className="flex flex-wrap gap-2">
                {p.skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-sm text-muted"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- process */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="rounded-3xl border border-hairline bg-surface/50 p-8 md:p-12">
          <SectionHead
            eyebrow="How it works"
            title="Simple, in four steps"
            sub="No long documents before anything gets built."
          />
          <ol className="grid gap-8 md:grid-cols-4">
            <Step n="01" title="You tell me the idea" body="A message, a sketch, or a link to something similar. Whatever you have." />
            <Step n="02" title="I scope it" body="What it will include, what it will cost, and how long it takes. In writing." />
            <Step n="03" title="I build it" body="You see working progress along the way, not just at the end." />
            <Step n="04" title="You get everything" body="The build, the source code, and what you need to run it yourself." />
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------- work CTA */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <Link
          href="/work"
          className="group flex flex-col items-start justify-between gap-6 rounded-3xl border border-hairline bg-gradient-to-br from-surface to-ink p-8 transition-colors hover:border-lime/40 md:flex-row md:items-center md:p-12"
        >
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-lime">
              Portfolio
            </p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
              See what I&apos;ve built
            </h2>
            <p className="mt-3 max-w-xl text-muted">
              {projectCount} projects across games, web, mobile and tools — most of them
              playable right in your browser.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-xl bg-lime px-6 py-3.5 font-semibold text-ink transition-transform group-hover:translate-x-1">
            Browse the work
            <icons.ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </Link>
      </section>

      {/* --------------------------------------------------------- contact */}
      <section id="contact" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <SectionHead
          eyebrow="Get in touch"
          title="Let's build something"
          sub="Tell me what you have in mind and I'll reply with a plan, a price and a timeline."
        />
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-3">
            <ContactRow
              icon={<icons.Mail className="h-4 w-4" />}
              label="Email"
              value={p.email}
              href={`mailto:${p.email}`}
            />
            <ContactRow
              icon={<icons.Phone className="h-4 w-4" />}
              label="Phone / WhatsApp"
              value={phone.display}
              href={phone.href}
            />
            {p.fiverr && (
              <ContactRow
                icon={<icons.Briefcase className="h-4 w-4" />}
                label="Fiverr"
                value="Order directly on Fiverr"
                href={p.fiverr}
                external
              />
            )}
          </div>
          <ContactForm fallbackEmail={p.email} />
        </div>
      </section>

      <SiteFooter name={p.name} />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-2xl font-extrabold text-text">{value}</dt>
      <dd className="mt-0.5 text-sm text-subtle">{label}</dd>
    </div>
  );
}

function Service({
  icon,
  title,
  promise,
  points,
}: {
  icon: React.ReactNode;
  title: string;
  promise: string;
  points: string[];
}) {
  return (
    <div className="group/svc relative overflow-hidden rounded-2xl border border-hairline bg-surface p-6 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-lime/40 hover:shadow-[0_20px_44px_-22px_rgba(0,0,0,0.95)] motion-reduce:hover:translate-y-0">
      {/* Light sweep that follows the card on hover. Purely decorative. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover/svc:opacity-100"
        style={{
          background:
            'radial-gradient(420px circle at 15% 0%, rgba(196,248,42,0.07), transparent 60%)',
        }}
      />
      <div className="relative mb-4 grid h-10 w-10 place-items-center rounded-xl bg-lime/10 text-lime transition-transform duration-300 group-hover/svc:scale-110 motion-reduce:group-hover/svc:scale-100">
        {icon}
      </div>
      <h3 className="relative text-lg font-semibold transition-colors duration-300 group-hover/svc:text-lime">
        {title}
      </h3>
      <p className="relative mt-1.5 text-sm text-muted">{promise}</p>
      <ul className="relative mt-4 space-y-2">
        {points.map((pt) => (
          <li key={pt} className="flex items-start gap-2 text-sm text-subtle">
            <icons.Check className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden />
            {pt}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li>
      <p className="font-display text-sm font-bold text-lime">{n}</p>
      <h3 className="mt-2 font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </li>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group flex items-center gap-4 rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-lime/40"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-lime">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-subtle">{label}</span>
        <span className="block truncate transition-colors group-hover:text-lime">{value}</span>
      </span>
    </a>
  );
}
