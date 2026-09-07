import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

const cx = (...c) => c.filter(Boolean).join(' ');

/* ---------------- Button ---------------- */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon = null,
  as,
  to,
  href,
  children,
  className,
  disabled,
  ...rest
}) {
  const cls = cx(
    'ui-btn',
    `ui-btn--${variant}`,
    size !== 'md' && `ui-btn--${size}`,
    block && 'ui-btn--block',
    className
  );
  const content = (
    <>
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      {!loading && icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{content}</a>;
  const Tag = as || 'button';
  return (
    <Tag className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </Tag>
  );
}

/* ---------------- Card ---------------- */
export function Card({ title, subtitle, actions, footer, flush = false, children, className, ...rest }) {
  return (
    <section className={cx('ui-card', className)} {...rest}>
      {(title || actions) && (
        <header className="ui-card__header">
          <div>
            {title && <h3 className="ui-card__title">{title}</h3>}
            {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ui-card__actions">{actions}</div>}
        </header>
      )}
      <div className={cx('ui-card__body', flush && 'ui-card__body--flush')}>{children}</div>
      {footer && <footer className="ui-card__footer">{footer}</footer>}
    </section>
  );
}

/* ---------------- StatCard ---------------- */
export function StatCard({ label, value, hint, icon }) {
  return (
    <div className="ui-stat">
      <div className="ui-stat__top">
        {icon && <Icon name={icon} size={16} className="ui-stat__icon" />}
        <span className="ui-stat__label">{label}</span>
      </div>
      <span className="ui-stat__value">{value}</span>
      {hint && <span className="ui-stat__hint">{hint}</span>}
    </div>
  );
}

/* ---------------- PageHeader ---------------- */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="ui-page-header">
      <div>
        <h1 className="ui-page-header__title">{title}</h1>
        {subtitle && <p className="ui-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </div>
  );
}

/* ---------------- Field / Select / DateRange ---------------- */
let fieldSeq = 0;
export function Field({ label, hint, error, id, children }) {
  const fid = id || `f${++fieldSeq}`;
  const child = React.isValidElement(children)
    ? React.cloneElement(children, {
        id: fid,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': cx(hint && `${fid}-hint`, error && `${fid}-err`) || undefined,
      })
    : children;
  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={fid}>{label}</label>
      {child}
      {hint && !error && <span className="ui-field__hint" id={`${fid}-hint`}>{hint}</span>}
      {error && <span className="ui-field__error" id={`${fid}-err`}>{error}</span>}
    </div>
  );
}

export function Select({ options = [], className, children, ...rest }) {
  return (
    <select className={cx('ui-select', className)} {...rest}>
      {children ||
        options.map((o) =>
          typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>
        )}
    </select>
  );
}

export function Input({ className, ...rest }) {
  return <input className={cx('ui-input', className)} {...rest} />;
}

export function DateRange({ from, to, onChange, min, max }) {
  return (
    <div className="ui-daterange">
      <Field label="From">
        <input
          type="date"
          className="ui-input"
          value={from || ''}
          max={to || max}
          min={min}
          onChange={(e) => onChange({ from: e.target.value, to })}
        />
      </Field>
      <Field label="To">
        <input
          type="date"
          className="ui-input"
          value={to || ''}
          min={from || min}
          max={max}
          onChange={(e) => onChange({ from, to: e.target.value })}
        />
      </Field>
    </div>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({ variant = 'neutral', icon, children }) {
  return (
    <span className={cx('ui-badge', `ui-badge--${variant}`)}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

/* ---------------- Alert ---------------- */
const ALERT_ICON = { info: 'info', success: 'check-circle', warning: 'alert-triangle', danger: 'alert-circle' };
export function Alert({ variant = 'info', title, onDismiss, children }) {
  return (
    <div className={cx('ui-alert', `ui-alert--${variant}`)} role={variant === 'danger' ? 'alert' : 'status'}>
      <Icon name={ALERT_ICON[variant]} size={18} className="ui-alert__icon" />
      <div className="ui-alert__body">
        {title && <div className="ui-alert__title">{title}</div>}
        {children}
      </div>
      {onDismiss && (
        <button type="button" className="ui-alert__close" onClick={onDismiss} aria-label="Dismiss">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ width = '100%', height = 16, radius, style }) {
  return <span className="ui-skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

/* ---------------- State blocks ---------------- */
export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="ui-state" role="status" aria-live="polite">
      <span className="ui-state__spinner" aria-hidden="true" />
      <span className="ui-state__msg">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title = 'No data', message, action }) {
  return (
    <div className="ui-state">
      <span className="ui-state__icon"><Icon name={icon} size={22} /></span>
      <span className="ui-state__title">{title}</span>
      {message && <span className="ui-state__msg">{message}</span>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="ui-state ui-state--error" role="alert">
      <span className="ui-state__icon"><Icon name="alert-triangle" size={22} /></span>
      <span className="ui-state__title">{title}</span>
      {message && <span className="ui-state__msg">{message}</span>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
