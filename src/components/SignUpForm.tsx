import React, { useState } from 'react';
import { Pizza, User, Phone, Mail, AlertCircle, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface FormData {
  name: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
}

interface FormErrors {
  name?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  password?: string;
  general?: string;
}

export default function SignUpForm() {
  const [isLogin, setIsLogin] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    if (!isLogin) {
      if (!formData.name.trim()) {
        newErrors.name = 'El nombre es requerido';
        isValid = false;
      } else if (formData.name.length < 2) {
        newErrors.name = 'El nombre debe tener al menos 2 caracteres';
        isValid = false;
      }

      if (!formData.lastName.trim()) {
        newErrors.lastName = 'El apellido es requerido';
        isValid = false;
      } else if (formData.lastName.length < 2) {
        newErrors.lastName = 'El apellido debe tener al menos 2 caracteres';
        isValid = false;
      }

      const phoneRegex = /^[0-9]{7,15}$/;
      if (!formData.phone.trim()) {
        newErrors.phone = 'El teléfono es requerido';
        isValid = false;
      } else if (!phoneRegex.test(formData.phone.replace(/\s+/g, ''))) {
        newErrors.phone = 'Ingresa un número de teléfono válido';
        isValid = false;
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'El correo es requerido';
      isValid = false;
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Ingresa un correo electrónico válido';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrors({});
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Check if user exists, if not, create profile
      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', user.uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
      
      if (userDoc && !userDoc.exists()) {
        const nameParts = user.displayName?.split(' ') || ['Usuario'];
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: firstName,
            lastName: lastName,
            phone: user.phoneNumber || '0000000',
            email: user.email || '',
            points: 0,
            role: 'client',
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      }

      setIsSubmitted(true);
    } catch (error: any) {
      console.error("Error signing in with Google", error);
      setErrors({ general: 'Error al iniciar sesión con Google. Intenta de nuevo.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsLoading(true);
      setErrors({});
      try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        if (isLogin) {
          // Login with Email/Password
          await signInWithEmailAndPassword(auth, formData.email, formData.password);
        } else {
          // Create user in Firebase Auth
          const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          const user = userCredential.user;

          // Save user profile in Firestore
          try {
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              name: formData.name,
              lastName: formData.lastName,
              phone: formData.phone,
              email: formData.email,
              points: 0,
              role: 'client',
              createdAt: serverTimestamp(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
          }

          setIsSubmitted(true);
        }
      } catch (error: any) {
        console.error("Error in auth operation", error);
        if (error.code === 'auth/email-already-in-use') {
          setErrors({ email: 'Este correo ya está registrado.' });
        } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          setErrors({ general: 'Credenciales incorrectas. Verifica tu correo y contraseña.' });
        } else if (error.code === 'auth/operation-not-allowed') {
          setErrors({ general: 'Esta operación no está habilitada. Por favor, habilítala en la consola de Firebase.' });
        } else {
          setErrors({ general: 'Ocurrió un error. Intenta de nuevo.' });
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] dark:bg-stone-900 flex items-center justify-center p-4 font-sans text-amber-950 dark:text-stone-100">
      <div className="max-w-md w-full bg-white dark:bg-stone-800 rounded-2xl shadow-xl overflow-hidden border border-amber-100 dark:border-stone-700">
        <div className="bg-amber-50 dark:bg-stone-900/50 p-6 text-center relative overflow-hidden border-b border-amber-100 dark:border-stone-700">
          <div className="absolute top-0 left-0 w-full h-full opacity-30 dark:opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
          <div className="relative z-10 flex flex-col items-center">
            <img src="/logo.png" alt="Leños Pizzería" className="w-24 h-24 object-contain mb-3 drop-shadow-md rounded-full" />
            <h2 className="text-2xl font-bold text-amber-950 dark:text-amber-500">Leños Pizzería</h2>
            <p className="text-amber-900 dark:text-stone-400 text-sm mt-1 font-medium">
              {isLogin ? 'Bienvenido de nuevo' : 'Únete a nuestro club de fidelización'}
            </p>
          </div>
        </div>

        <div className="flex border-b border-amber-100 dark:border-stone-700">
          <button
            onClick={() => { setIsLogin(false); setErrors({}); }}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${!isLogin ? 'text-red-700 dark:text-red-400 border-b-2 border-red-700 dark:border-red-400 bg-amber-50/50 dark:bg-stone-700/50' : 'text-amber-700 dark:text-stone-300 hover:text-amber-900 dark:hover:text-stone-100'}`}
          >
            Registrarse
          </button>
          <button
            onClick={() => { setIsLogin(true); setErrors({}); }}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${isLogin ? 'text-red-700 dark:text-red-400 border-b-2 border-red-700 dark:border-red-400 bg-amber-50/50 dark:bg-stone-700/50' : 'text-amber-700 dark:text-stone-300 hover:text-amber-900 dark:hover:text-stone-100'}`}
          >
            Iniciar Sesión
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {isSubmitted && !isLogin ? (
            <div className="text-center py-8 animate-in fade-in zoom-in duration-300">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-amber-900 mb-2">¡Registro Exitoso!</h3>
              <p className="text-amber-700">Bienvenido a la familia Leños. Preparando tu primera porción...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  <p>{errors.general}</p>
                </div>
              )}
              
              {!isLogin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label htmlFor="name" className="block text-sm font-medium text-amber-900">Nombre</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-amber-400" />
                      </div>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={`block w-full pl-10 pr-3 py-2.5 border ${errors.name ? 'border-red-500 focus:ring-red-500' : 'border-amber-200 focus:ring-red-600'} rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:border-transparent bg-[#fdfbf7] transition-colors`}
                        placeholder="Juan"
                      />
                    </div>
                    {errors.name && <p className="text-red-500 text-xs flex items-center mt-1"><AlertCircle className="w-3 h-3 mr-1" /> {errors.name}</p>}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="lastName" className="block text-sm font-medium text-amber-900">Apellido</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-amber-400" />
                      </div>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className={`block w-full pl-10 pr-3 py-2.5 border ${errors.lastName ? 'border-red-500 focus:ring-red-500' : 'border-amber-200 focus:ring-red-600'} rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:border-transparent bg-[#fdfbf7] transition-colors`}
                        placeholder="Pérez"
                      />
                    </div>
                    {errors.lastName && <p className="text-red-500 text-xs flex items-center mt-1"><AlertCircle className="w-3 h-3 mr-1" /> {errors.lastName}</p>}
                  </div>
                </div>
              )}

              {!isLogin && (
                <div className="space-y-1">
                  <label htmlFor="phone" className="block text-sm font-medium text-amber-900">Teléfono</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-amber-400" />
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-3 py-2.5 border ${errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-amber-200 focus:ring-red-600'} rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:border-transparent bg-[#fdfbf7] transition-colors`}
                      placeholder="300 123 4567"
                    />
                  </div>
                  {errors.phone && <p className="text-red-500 text-xs flex items-center mt-1"><AlertCircle className="w-3 h-3 mr-1" /> {errors.phone}</p>}
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="email" className="block text-sm font-medium text-amber-900">Correo Electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-amber-400" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-2.5 border ${errors.email ? 'border-red-500 focus:ring-red-500' : 'border-amber-200 focus:ring-red-600'} rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:border-transparent bg-[#fdfbf7] transition-colors`}
                    placeholder="juan@ejemplo.com"
                  />
                </div>
                {errors.email && <p className="text-red-500 text-xs flex items-center mt-1"><AlertCircle className="w-3 h-3 mr-1" /> {errors.email}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="block text-sm font-medium text-amber-900">Contraseña</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-amber-400" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={formData.password}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-2.5 border ${errors.password ? 'border-red-500 focus:ring-red-500' : 'border-amber-200 focus:ring-red-600'} rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:border-transparent bg-[#fdfbf7] transition-colors`}
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && <p className="text-red-500 text-xs flex items-center mt-1"><AlertCircle className="w-3 h-3 mr-1" /> {errors.password}</p>}
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-amber-300 rounded cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-amber-900 cursor-pointer">
                    Mantener sesión iniciada
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 transition-colors mt-6 disabled:opacity-70"
              >
                {isLoading ? 'Procesando...' : isLogin ? 'Iniciar Sesión' : 'Registrarme y ganar puntos'}
                {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
              </button>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-amber-200 dark:border-stone-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-stone-800 text-amber-700 dark:text-stone-300">O ingresa con</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-amber-200 dark:border-stone-600 rounded-xl shadow-sm text-sm font-medium text-amber-900 dark:text-stone-200 bg-white dark:bg-stone-700 hover:bg-amber-50 dark:hover:bg-stone-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors disabled:opacity-70"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  <path fill="none" d="M1 1h22v22H1z" />
                </svg>
                Continuar con Google
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
