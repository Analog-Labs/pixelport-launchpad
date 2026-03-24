import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-satoshi font-bold text-foreground">Privacy Policy</h1>
      <p className="mt-3 text-muted-foreground">
        PixelPort stores account and workspace data needed to operate the product. We do not sell
        personal data.
      </p>
      <p className="mt-3 text-muted-foreground">
        Access is restricted to authorized systems and users. We continuously improve security and
        monitoring as the platform scales.
      </p>
      <Link to="/" className="mt-8 inline-block text-primary underline hover:text-primary/90">
        Return to Home
      </Link>
    </div>
  );
}
