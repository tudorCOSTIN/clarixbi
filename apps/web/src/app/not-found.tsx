import Link from 'next/link';
import './globals.css';

export default function NotFound() {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-gray-50">
          <span className="text-lg font-bold text-dark-navy">ClarixBI</span>
          <h1 className="text-6xl font-bold text-gray-300">404</h1>
          <p className="text-gray-500">The page you are looking for does not exist.</p>
          <Link
            href="/"
            className="px-4 py-2 bg-primary-blue text-white rounded-md hover:opacity-90 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </body>
    </html>
  );
}
