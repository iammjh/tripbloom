import React, { useSyncExternalStore } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { confirmStore } from '../../utils/confirmStore.js';

// Mounted once in main.jsx. Opens whenever confirmAction() is called and resolves the caller's promise.
// For destructive actions, Cancel receives focus first so Enter does not confirm by accident.
export default function ConfirmDialog() {
  const options = useSyncExternalStore(confirmStore.subscribe, confirmStore.getSnapshot, confirmStore.getSnapshot);
  const answer = result => confirmStore.answer(result);

  return (
    <Modal
      open={Boolean(options)}
      onClose={() => answer(false)}
      title={options ? options.title : ''}
      description={options ? options.message : undefined}
      size="sm"
      footer={options && (
        <>
          <Button variant="secondary" data-autofocus={options.danger || undefined} onClick={() => answer(false)}>
            {options.cancelLabel}
          </Button>
          <Button variant={options.danger ? 'danger' : 'primary'} data-autofocus={options.danger ? undefined : true} onClick={() => answer(true)}>
            {options.confirmLabel}
          </Button>
        </>
      )}
    >
      {null}
    </Modal>
  );
}
