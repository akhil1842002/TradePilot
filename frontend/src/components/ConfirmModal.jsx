import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

const ConfirmModal = ({ show, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, variant }) => {
  if (!show) return null;

  const btnColor = variant === 'danger' ? '#EF4444' : '#3B82F6';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(3px)'
      }}
      onClick={onCancel}
    >
      <div
        className="tp-card"
        style={{
          maxWidth: '420px',
          width: '90%',
          border: `1px solid ${btnColor}44`,
          boxShadow: `0 0 30px rgba(0,0,0,0.5)`,
          animation: 'fadeInScale 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex align-items-start gap-3">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
            style={{
              width: '42px',
              height: '42px',
              backgroundColor: variant === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
              color: btnColor,
              fontSize: '1.1rem'
            }}
          >
            <FaExclamationTriangle />
          </div>
          <div className="flex-grow-1">
            <h6 className="fw-bold text-white mb-1">{title || 'Confirm Action'}</h6>
            <p className="text-muted mb-0" style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
              {message || 'Are you sure you want to proceed?'}
            </p>
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--tp-border)' }}>
          <button
            className="btn btn-sm btn-outline-secondary px-3"
            onClick={onCancel}
          >
            {cancelLabel || 'Cancel'}
          </button>
          <button
            className="btn btn-sm px-4 fw-bold text-white"
            style={{ backgroundColor: btnColor, border: 'none' }}
            onClick={onConfirm}
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ConfirmModal;
