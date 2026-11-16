import React, { useState, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { collection, query, where, onSnapshot, doc, updateDoc, increment, getDoc, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import QRCode from 'react-qr-code';
import { Camera, Users, Share2, Plus, Gift, X, LogOut, Pizza, Search, CheckCircle2, Edit2, Trash2, Save, Printer, Download, ExternalLink, Globe, Sparkles } from 'lucide-react';

interface UserData {
  uid: string;
  name: string;
  lastName: string;
  phone: string;
  email: string;
  points: number;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'users' | 'share'>('scanner');
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Scanner & Modal State
  const [scannedUser, setScannedUser] = useState<UserData | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    lastName: '',
    phone: ''
  });

  useEffect(() => {
    // Check for scan parameter in URL
    const params = new URLSearchParams(window.location.search);
    const scanUid = params.get('scan');
    if (scanUid) {
      // Clear the scan parameter from URL without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('scan');
      window.history.replaceState({}, '', url.toString());
      
      // Look up and open the user
      handleLookup(scanUid);
    }

    // Listen to all clients
    const q = query(collection(db, 'users'), where('role', '==', 'client'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: UserData[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserData);
      });
      setUsersList(users);
      
      // Update scanned user if it's currently open in the modal
      if (scannedUser) {
        const updatedScannedUser = users.find(u => u.uid === scannedUser.uid);
        if (updatedScannedUser) {
          setScannedUser(updatedScannedUser);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [scannedUser]);

  const handleLogout = () => {
    signOut(auth);
  };

  const handleLookup = async (uid: string) => {
    setIsScanning(false);
    setIsProcessing(true);

    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.role === 'client') {
          setScannedUser(data as UserData);
        } else {
          alert('Este usuario es un Administrador y no puede participar en el programa de puntos.');
          setIsScanning(true);
        }
      } else {
        alert('Código QR no reconocido. Asegúrate de que el cliente esté registrado.');
        setIsScanning(true);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      setIsScanning(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScan = async (result: any) => {
    if (!isScanning) return;
    
    // Result handling based on @yudiel/react-qr-scanner v2.x
    let rawValue = "";
    if (Array.isArray(result) && result.length > 0) {
      rawValue = result[0].rawValue;
    } else if (typeof result === 'string') {
      rawValue = result;
    } else if (result && typeof result === 'object' && result.rawValue) {
      rawValue = result.rawValue;
    }

    if (!rawValue) return;

    // Extract UID if it's a URL or contains ?scan=
    let uid = rawValue.trim();
    try {
      if (uid.includes('?scan=') || uid.includes('&scan=')) {
        const match = uid.match(/[\?&]scan=([^&#\s]+)/);
        if (match && match[1]) {
          uid = match[1];
        } else {
          const urlParams = new URL(uid).searchParams;
          uid = urlParams.get('scan') || uid;
        }
      }
    } catch (e) {
      const match = uid.match(/[\?&]scan=([^&#\s]+)/);
      if (match && match[1]) {
        uid = match[1];
      }
    }

    handleLookup(uid);
  };

  const handleScannerError = (error: any) => {
    console.error("Scanner Error:", error);
    // Common errors: NotAllowedError, NotFoundError
    if (error?.name === 'NotAllowedError') {
      alert('Error de cámara: Permiso denegado. Por favor, permite el acceso a la cámara en tu navegador.');
    } else if (error?.name === 'NotFoundError') {
      alert('Error de cámara: No se encontró ninguna cámara en este dispositivo.');
    } else {
      // Don't alert for every minor error as some might be transient during initialization
    }
  };

  const handleAddPoint = async (uid: string) => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        points: increment(1)
      });
      setActionSuccess('¡Punto añadido exitosamente!');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRedeem = async (uid: string) => {
    if (!window.confirm('¿Estás seguro de canjear la Pizzeta? Los puntos volverán a 0.')) return;
    
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        points: 0
      });
      setActionSuccess('¡Pizzeta canjeada exitosamente!');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) return;
    
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setActionSuccess('Cliente eliminado exitosamente.');
      setTimeout(() => {
        setActionSuccess(null);
        closeModal();
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedUser) return;

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'users', scannedUser.uid), {
        name: editFormData.name,
        lastName: editFormData.lastName,
        phone: editFormData.phone
      });
      setActionSuccess('Datos actualizados exitosamente.');
      setIsEditing(false);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${scannedUser.uid}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const startEditing = () => {
    if (!scannedUser) return;
    setEditFormData({
      name: scannedUser.name,
      lastName: scannedUser.lastName,
      phone: scannedUser.phone
    });
    setIsEditing(true);
  };

  const closeModal = () => {
    setScannedUser(null);
    setIsScanning(true);
    setActionSuccess(null);
    setIsEditing(false);
  };

  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone.includes(searchTerm)
  );

  const [customUrl, setCustomUrl] = useState<string>(() => {
    const saved = localStorage.getItem('pizzeria_custom_url');
    // If it was previously saved to hostinger domain, reset to default app url
    if (saved && saved.includes('xn--leospizzeria-bhb.com')) {
      localStorage.removeItem('pizzeria_custom_url');
      return '';
    }
    return saved || '';
  });
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Get a clean base URL for sharing that points directly to the online loyalty app
  const getAppUrl = () => {
    if (customUrl.trim()) {
      return customUrl.trim();
    }
    try {
      const url = new URL(window.location.href);
      let origin = url.origin;
      // Convert private dev URL (ais-dev-) to public shareable URL (ais-pre-)
      if (origin.includes('ais-dev-')) {
        origin = origin.replace('ais-dev-', 'ais-pre-');
      }
      return `${origin}/`;
    } catch (e) {
      return 'https://ais-pre-vwf5drnylcearxi6osraqr-612098930506.us-east1.run.app/';
    }
  };

  const appUrl = getAppUrl();

  const handleSaveCustomUrl = (newUrl: string) => {
    setCustomUrl(newUrl);
    localStorage.setItem('pizzeria_custom_url', newUrl);
    setIsEditingUrl(false);
  };

  const handleResetUrl = () => {
    setCustomUrl('');
    localStorage.removeItem('pizzeria_custom_url');
    setIsEditingUrl(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] dark:bg-stone-900 font-sans text-amber-950 dark:text-stone-100 pb-24">
      {/* Header */}
      <header className="bg-amber-50 dark:bg-stone-900/50 text-amber-950 dark:text-amber-500 p-4 shadow-md relative overflow-hidden border-b border-amber-100 dark:border-stone-700">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 dark:opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
        <div className="relative z-10 flex justify-between items-center max-w-3xl mx-auto">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-full shadow-sm" />
            <h1 className="font-bold text-xl">Panel de Administración</h1>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-amber-200 dark:hover:bg-stone-800 rounded-full transition-colors text-amber-950 dark:text-stone-400" aria-label="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 mt-4">
        {/* TAB: SCANNER */}
        {activeTab === 'scanner' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-300">Escanear Cliente</h2>
              <p className="text-amber-900 dark:text-amber-200">Apunta la cámara al código QR del cliente para sumar puntos o canjear premios.</p>
            </div>
            
            <div className="bg-black rounded-3xl overflow-hidden shadow-xl max-w-md mx-auto aspect-square relative border-4 border-amber-200">
              {isScanning ? (
                <Scanner 
                  onScan={handleScan}
                  onError={handleScannerError}
                  components={{ finder: true }}
                  styles={{ container: { width: '100%', height: '100%' } }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-amber-900 bg-opacity-90 text-white flex-col p-6 text-center">
                  {isProcessing ? (
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                  ) : (
                    <CheckCircle2 className="w-16 h-16 text-green-400 mb-4" />
                  )}
                  <p className="text-lg font-medium">{isProcessing ? 'Procesando...' : 'Usuario escaneado'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: USERS LIST */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-amber-900">Base de Clientes</h2>
              <p className="text-amber-700">Gestiona los puntos y visualiza la información de tus clientes.</p>
            </div>

            <div className="relative max-w-md mx-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-amber-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-amber-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-red-600 bg-white"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
              <ul className="divide-y divide-amber-100">
                {filteredUsers.length === 0 ? (
                  <li className="p-6 text-center text-amber-600">No se encontraron clientes.</li>
                ) : (
                  filteredUsers.map((user) => (
                    <li key={user.uid} className="p-4 hover:bg-amber-50 transition-colors flex items-center justify-between cursor-pointer group" onClick={() => setScannedUser(user)}>
                      <div className="flex-1">
                        <p className="font-bold text-amber-900">{user.name} {user.lastName}</p>
                        <p className="text-sm text-amber-600">{user.phone} • {user.email}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${user.points >= 6 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {user.points}/6 pts
                        </div>
                        <div className="flex space-x-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setScannedUser(user); startEditing(); }}
                            className="p-2.5 bg-amber-100 text-amber-800 hover:bg-amber-200 hover:text-red-700 transition-all rounded-xl shadow-sm"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.uid); }}
                            className="p-2.5 bg-red-50 text-red-700 hover:bg-red-100 transition-all rounded-xl shadow-sm"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}

        {/* TAB: SHARE */}
        {activeTab === 'share' && (
          <div className="space-y-6 animate-in fade-in duration-300 flex flex-col items-center max-w-md mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-300">Código QR para Clientes</h2>
              <p className="text-amber-900 dark:text-amber-200 text-sm">
                Coloca este código en mesas y caja. Los clientes lo escanearán para registrarse y empezar a acumular porciones gratis.
              </p>
            </div>
            
            <div className="bg-white dark:bg-stone-800 p-6 sm:p-8 rounded-3xl shadow-md border border-amber-100 dark:border-stone-700 flex flex-col items-center w-full">
              {/* QR Container */}
              <div className="p-4 bg-white rounded-2xl shadow-inner mb-5 border-2 border-amber-100 flex flex-col items-center">
                <div className="mb-2 flex items-center space-x-2">
                  <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain rounded-full" />
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wider">Leños Pizzería</span>
                </div>
                <QRCode key={appUrl} value={appUrl} size={210} fgColor="#1c1917" />
                <span className="text-[10px] text-stone-500 font-mono mt-2 tracking-wide uppercase font-bold">Escanea con tu cámara</span>
              </div>
              
              <div className="w-full space-y-4">
                {/* Actions: Print and Open */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="flex items-center justify-center py-2.5 px-3 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold text-xs shadow-sm transition-colors"
                  >
                    <Printer className="w-4 h-4 mr-1.5" />
                    Imprimir Cartel
                  </button>
                  <a
                    href={appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center py-2.5 px-3 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl font-bold text-xs shadow-sm transition-colors text-center"
                  >
                    <ExternalLink className="w-4 h-4 mr-1.5" />
                    Probar Enlace
                  </a>
                </div>

                {/* Direct Link box */}
                <div className="bg-amber-50 dark:bg-stone-900/50 p-3 rounded-xl border border-amber-100 dark:border-stone-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center">
                      <Globe className="w-3.5 h-3.5 mr-1" />
                      Enlace Directo
                    </span>
                    <button
                      onClick={() => setIsEditingUrl(!isEditingUrl)}
                      className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-medium"
                    >
                      {isEditingUrl ? 'Cancelar' : 'Cambiar URL'}
                    </button>
                  </div>

                  {isEditingUrl ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const newUrl = formData.get('url') as string;
                        if (newUrl) handleSaveCustomUrl(newUrl);
                      }}
                      className="space-y-2 mt-2"
                    >
                      <input
                        name="url"
                        defaultValue={appUrl}
                        type="url"
                        placeholder="https://tupizzeria.com"
                        className="w-full p-2 text-xs border border-amber-300 rounded-lg bg-white text-stone-900 focus:ring-2 focus:ring-red-600 outline-none font-mono"
                        required
                      />
                      <div className="flex space-x-2">
                        <button
                          type="submit"
                          className="flex-1 py-1.5 bg-red-700 text-white rounded-lg text-xs font-bold hover:bg-red-800"
                        >
                          Guardar URL
                        </button>
                        {customUrl && (
                          <button
                            type="button"
                            onClick={handleResetUrl}
                            className="py-1.5 px-3 bg-stone-200 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-300"
                          >
                            Restablecer
                          </button>
                        )}
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between mt-1">
                      <code className="text-xs text-amber-950 dark:text-stone-300 break-all mr-2 truncate font-mono">{appUrl}</code>
                      <button 
                        onClick={handleCopyLink}
                        className="p-2 bg-white dark:bg-stone-700 text-red-700 dark:text-red-400 rounded-lg shadow-sm hover:bg-red-50 dark:hover:bg-stone-600 transition-colors flex-shrink-0"
                        title="Copiar enlace"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Plus className="w-4 h-4 rotate-45" />}
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="bg-amber-100/50 dark:bg-stone-700/30 p-3.5 rounded-2xl border border-amber-200/50 dark:border-stone-600/50">
                  <div className="flex items-start space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 dark:text-stone-300 leading-relaxed">
                      <strong>Acceso Directo:</strong> Este código QR dirige a los clientes 100% directo al registro y tarjeta de lealtad en su navegador móvil (sin pasar por chats ni herramientas de desarrollo).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Printable Flyer Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex justify-between items-center text-amber-950">
              <span className="font-bold text-sm flex items-center">
                <Printer className="w-4 h-4 mr-2 text-red-700" />
                Cartel para Mesas / Mostrador
              </span>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="p-1 hover:bg-amber-200 rounded-full text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Preview Area */}
            <div className="p-6 overflow-y-auto flex flex-col items-center text-center bg-[#fffdf9]">
              <div id="printable-flyer" className="w-full border-4 border-amber-900/80 rounded-3xl p-6 bg-white shadow-sm flex flex-col items-center relative overflow-hidden">
                <div className="w-16 h-16 rounded-full overflow-hidden mb-3 border-2 border-amber-900 shadow-md">
                  <img src="/logo.png" alt="Leños Pizzería" className="w-full h-full object-contain" />
                </div>
                
                <h2 className="text-2xl font-black text-red-700 tracking-tight uppercase mb-0.5">
                  Leños Pizzería
                </h2>
                <p className="text-sm font-bold text-amber-900 mb-4 tracking-wide">
                  PROGRAMA DE LEALTAD
                </p>

                <div className="p-3 bg-white rounded-2xl border-2 border-dashed border-amber-800 shadow-sm mb-4">
                  <QRCode value={appUrl} size={190} fgColor="#1c1917" />
                </div>

                <div className="space-y-1 text-stone-800 text-xs font-medium max-w-xs mb-4">
                  <p className="font-black text-amber-950 text-sm">¡Gana Pizzetas Gratis!</p>
                  <p>1. Escanea este código con tu celular 📱</p>
                  <p>2. Regístrate en 10 segundos ⏱️</p>
                  <p>3. Acumula 6 porciones y canjea tu premio 🍕</p>
                </div>

                <div className="w-full pt-3 border-t border-amber-200 text-[10px] text-amber-800 font-mono">
                  {appUrl}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-white border-t border-stone-200 flex space-x-3">
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100"
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-red-700 text-white font-bold text-xs hover:bg-red-800 flex items-center justify-center shadow-sm"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir Ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Action Modal */}
      {scannedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-amber-50 p-4 flex justify-between items-center text-amber-950 relative border-b border-amber-100">
              <div className="absolute top-0 left-0 w-full h-full opacity-30 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
              <h3 className="font-bold text-lg relative z-10">Perfil del Cliente</h3>
              <button onClick={closeModal} className="p-1 hover:bg-amber-200 rounded-full relative z-10 text-amber-950">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {actionSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center justify-center font-medium animate-in slide-in-from-top-2">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  {actionSuccess}
                </div>
              )}

              {isEditing ? (
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-amber-600 uppercase mb-1">Nombre</label>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full p-3 border border-amber-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-600 uppercase mb-1">Apellido</label>
                    <input
                      type="text"
                      value={editFormData.lastName}
                      onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      className="w-full p-3 border border-amber-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-600 uppercase mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="w-full p-3 border border-amber-200 rounded-xl focus:ring-2 focus:ring-red-600 outline-none"
                      required
                    />
                  </div>
                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-3 px-4 rounded-xl border border-amber-200 text-amber-700 font-bold hover:bg-amber-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="flex-1 py-3 px-4 rounded-xl bg-red-700 text-white font-bold hover:bg-red-800 transition-colors flex items-center justify-center"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Guardar
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="text-center relative">
                    <p className="text-2xl font-bold text-amber-900">{scannedUser.name} {scannedUser.lastName}</p>
                    <p className="text-amber-600">{scannedUser.phone}</p>
                    <p className="text-xs text-amber-400">{scannedUser.email}</p>
                    <div className="absolute -top-2 -right-2 flex space-x-2">
                      <button 
                        onClick={startEditing}
                        className="p-2.5 bg-white border border-amber-100 shadow-sm text-amber-600 hover:text-red-700 transition-colors rounded-full"
                        title="Editar datos"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(scannedUser.uid)}
                        className="p-2.5 bg-white border border-amber-100 shadow-sm text-amber-600 hover:text-red-700 transition-colors rounded-full"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="relative w-40 h-40">
                      {/* Background Logo (Grayscale/Dark) */}
                      <div className="absolute inset-0 rounded-full border-[4px] border-amber-900 bg-[#290f02] overflow-hidden shadow-lg">
                        <img 
                          src="/logo.png" 
                          alt="Logo Background" 
                          className="w-full h-full object-cover opacity-30 grayscale" 
                        />
                      </div>

                      {/* Foreground Logo (Revealed by Slices) */}
                      <div className="absolute inset-0 rounded-full border-[4px] border-transparent overflow-hidden z-10">
                        <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0 transform -rotate-90">
                          <defs>
                            <clipPath id={`admin-logo-clip-${scannedUser.uid}`}>
                              {Array.from({ length: 6 }).map((_, i) => (
                                i < scannedUser.points && (
                                  <path
                                    key={i}
                                    d="M 50 50 L 50 0 A 50 50 0 0 1 93.301 25 Z"
                                    transform={`rotate(${i * 60}, 50, 50)`}
                                  />
                                )
                              ))}
                            </clipPath>
                          </defs>
                          <foreignObject x="0" y="0" width="100" height="100" clipPath={`url(#admin-logo-clip-${scannedUser.uid})`}>
                            <img 
                              src="/logo.png" 
                              alt="Logo Progress" 
                              className="w-full h-full object-cover transform rotate-90" 
                              style={{ width: '100px', height: '100px' }}
                            />
                          </foreignObject>
                        </svg>
                      </div>

                      {/* Slice Dividers */}
                      <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0 transform -rotate-90 z-20 pointer-events-none">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <line
                            key={i}
                            x1="50" y1="50"
                            x2="50" y2="0"
                            stroke="#290f02"
                            strokeWidth="0.5"
                            transform={`rotate(${i * 60}, 50, 50)`}
                            opacity="0.5"
                          />
                        ))}
                      </svg>

                      {/* Center decoration */}
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center z-30 border border-amber-900">
                        <span className="font-black text-red-700 text-sm">{scannedUser.points}/6</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => handleAddPoint(scannedUser.uid)}
                      disabled={scannedUser.points >= 6 || isProcessing}
                      className="w-full flex items-center justify-center py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-red-700 hover:bg-red-800 disabled:bg-amber-200 disabled:text-amber-500 transition-colors"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      +1 Punto
                    </button>
                    
                    <button
                      onClick={() => handleRedeem(scannedUser.uid)}
                      disabled={scannedUser.points < 6 || isProcessing}
                      className="w-full flex items-center justify-center py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:bg-amber-100 disabled:text-amber-400 transition-colors"
                    >
                      <Gift className="w-5 h-5 mr-2" />
                      Canjear Pizzeta
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-stone-900 border-t border-amber-100 dark:border-stone-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 pb-safe">
        <div className="flex justify-around max-w-md mx-auto">
          <button 
            onClick={() => { setActiveTab('scanner'); setIsScanning(true); }}
            className={`flex flex-col items-center py-3 px-6 ${activeTab === 'scanner' ? 'text-red-700 dark:text-red-500' : 'text-amber-400 dark:text-stone-500 hover:text-amber-600 dark:hover:text-stone-300'}`}
          >
            <Camera className="w-6 h-6 mb-1" />
            <span className="text-xs font-bold">Escáner</span>
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex flex-col items-center py-3 px-6 ${activeTab === 'users' ? 'text-red-700 dark:text-red-500' : 'text-amber-400 dark:text-stone-500 hover:text-amber-600 dark:hover:text-stone-300'}`}
          >
            <Users className="w-6 h-6 mb-1" />
            <span className="text-xs font-bold">Clientes</span>
          </button>
          <button 
            onClick={() => setActiveTab('share')}
            className={`flex flex-col items-center py-3 px-6 ${activeTab === 'share' ? 'text-red-700 dark:text-red-500' : 'text-amber-400 dark:text-stone-500 hover:text-amber-600 dark:hover:text-stone-300'}`}
          >
            <Share2 className="w-6 h-6 mb-1" />
            <span className="text-xs font-bold">Compartir</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
