import Link from 'next/link';

export default function NotFound() {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h1 className="text-4xl font-bold">404</h1>
          <p className="text-gray-500">Page not found</p>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </body>
    </html>
  );
}
