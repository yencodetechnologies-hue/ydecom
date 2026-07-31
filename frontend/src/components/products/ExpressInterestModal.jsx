import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { Button, Input } from '../ui/Form';

export default function ExpressInterestModal({
  open,
  productName,
  onClose,
  onSubmit,
  submitting = false,
  initialQuantity = 1,
  isEditing = false,
}) {
  const [quantity, setQuantity] = useState(String(initialQuantity));

  useEffect(() => {
    if (open) setQuantity(String(initialQuantity || 1));
  }, [open, productName, initialQuantity]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = Number.parseInt(quantity, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    onSubmit(parsed);
  };

  return (
    <Modal
      open={open}
      title={isEditing ? 'Edit interest quantity' : 'Express interest'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ink/70">
          {isEditing ? (
            <>
              Update how many units of <strong>{productName}</strong> you need. The supplier will
              be notified of the change.
            </>
          ) : (
            <>
              <strong>{productName}</strong> is currently out of stock. Enter how many units you
              need and we will notify the supplier.
            </>
          )}
        </p>
        <Input
          label="Quantity needed"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEditing ? 'Update interest' : 'Submit interest'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
