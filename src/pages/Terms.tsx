import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-satoshi font-bold text-foreground">Terms of Service</h1>
      <p className="mt-3 text-muted-foreground">
        PixelPort is provided as-is during the current release phase. By using the service, you agree
        to use it lawfully and avoid abusive or malicious activity.
      </p>
      <p className="mt-3 text-muted-foreground">
        We may update these terms as the product evolves. Continued use of the service after updates
        means you accept the revised terms.
      </p>
      <Link to="/" className="mt-8 inline-block text-primary underline hover:text-primary/90">
        Return to Home
      </Link>
    </div>
  );
}
