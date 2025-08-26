'use client';

import AuthForm from '../components/AuthForm';
import Footer from '../components/Footer';
import Header from '../components/Header';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 flex flex-col">
      <Header />

      <main className="flex-grow flex items-center justify-center">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Вход в систему
              </h1>
            </div>
            <AuthForm />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

