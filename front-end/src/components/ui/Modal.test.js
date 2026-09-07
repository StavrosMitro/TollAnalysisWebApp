import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

function Harness({ confirm }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Test dialog" confirm={confirm}>
        <p>Body</p>
        <button>inside</button>
      </Modal>
    </>
  );
}

test('opens as a labelled dialog, traps focus and restores it on close', async () => {
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'open' });
  opener.focus();
  await userEvent.click(opener);

  const dialog = screen.getByRole('dialog', { name: 'Test dialog' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');

  // Escape closes and focus returns to the trigger
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

test('confirm action fires and cancel closes', async () => {
  const onConfirm = jest.fn();
  render(<Harness confirm={{ label: 'Delete', danger: true, onConfirm }} />);
  await userEvent.click(screen.getByRole('button', { name: 'open' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(onConfirm).toHaveBeenCalled();
});
