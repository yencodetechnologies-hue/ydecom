let loadPromise = null;

/** Load Razorpay Checkout script once. */
export const loadRazorpayScript = () => {
  if (typeof window !== 'undefined' && window.Razorpay) {
    return Promise.resolve(true);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      loadPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return loadPromise;
};

/**
 * Open Razorpay Checkout and resolve with payment response on success.
 * Rejects on dismiss / failure.
 */
export const openRazorpayCheckout = (options) =>
  new Promise(async (resolve, reject) => {
    const ok = await loadRazorpayScript();
    if (!ok || !window.Razorpay) {
      reject(new Error('Unable to load Razorpay. Check your connection.'));
      return;
    }

    const rzp = new window.Razorpay({
      ...options,
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
        ...(options.modal || {}),
      },
    });

    rzp.on('payment.failed', (response) => {
      reject(new Error(response?.error?.description || 'Payment failed'));
    });

    rzp.open();
  });
