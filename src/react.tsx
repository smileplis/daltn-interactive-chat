'use client';

import {useId, useRef, useState, type FormEvent} from 'react';
import {Interaction as InteractionSchema, validateResponse, type Interaction, type InteractionValues, type Control} from './index.js';

export type InteractionFormProps = {
  interaction: Interaction;
  onSubmit: (values: InteractionValues) => void | Promise<void>;
  disabled?: boolean;
  pending?: boolean;
  error?: string;
  initialValues?: InteractionValues;
  readOnly?: boolean;
};

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error && Array.isArray(error.issues)) {
    const first = error.issues[0] as {message?: unknown} | undefined;
    if (typeof first?.message === 'string') return first.message;
  }
  return error instanceof Error ? error.message : 'Check your answers and try again.';
}

function readable(control: Control, value: InteractionValues[string] | undefined): string {
  if (value === undefined || value === '') return 'Not provided';
  if (control.kind === 'single_choice') return control.options.find(option => option.value === value)?.label ?? 'Not provided';
  if (control.kind === 'multi_choice' && Array.isArray(value)) return value.map(item => control.options.find(option => option.value === item)?.label ?? '').filter(Boolean).join(', ') || 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** A provider-neutral renderer. Selecting context never executes a tool or approves an action. */
export function InteractionForm(props: InteractionFormProps) {
  const interaction = InteractionSchema.parse(props.interaction);
  // A new saved question starts a fresh selection; returning to it restores supplied persisted values.
  return <InteractionFields key={JSON.stringify([interaction, props.initialValues ?? null, !!props.readOnly])} {...props} interaction={interaction}/>;
}

function InteractionFields({interaction, onSubmit, disabled = false, pending = false, error = '', initialValues = {}, readOnly = false}: InteractionFormProps) {
  const id = useId(), lock = useRef(false);
  const [values, setValues] = useState<InteractionValues>(initialValues);
  const [validation, setValidation] = useState(''), [submitting, setSubmitting] = useState(false);
  const busy = pending || submitting, blocked = disabled || busy || readOnly;
  const update = (key: string, value: InteractionValues[string]) => {
    if (blocked) return;
    setValidation('');
    setValues(current => ({...current, [key]: value}));
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || lock.current) return;
    try {
      const candidate = {...values};
      for (const control of interaction.controls) {
        if (control.kind === 'number' && typeof candidate[control.key] === 'string' && candidate[control.key] !== '') candidate[control.key] = Number(candidate[control.key]);
      }
      const validated = validateResponse(interaction, candidate);
      lock.current = true;
      setValidation(''); setSubmitting(true);
      await onSubmit(validated);
    } catch (cause) {
      setValidation(errorText(cause));
    } finally {
      lock.current = false; setSubmitting(false);
    }
  }
  const heading = <header className="dic-heading"><h3 id={`${id}-question`}>{interaction.question}</h3>{interaction.description && <p>{interaction.description}</p>}</header>;
  if (readOnly) return <section className="dic-interaction dic-readonly" aria-labelledby={`${id}-question`}>
    {heading}
    {Object.keys(initialValues).length ? <dl className="dic-summary">{interaction.controls.map(control => <div key={control.key}><dt>{control.label}</dt><dd>{readable(control, initialValues[control.key])}</dd></div>)}</dl> : <p className="dic-help">Continue in the latest message to answer this question.</p>}
  </section>;
  return <form className="dic-interaction" aria-label="Interactive reply" aria-busy={busy} onSubmit={submit} noValidate>
    {heading}
    <div className="dic-controls">{interaction.controls.map(control => {
      const controlId = `${id}-${control.key}`, value = values[control.key];
      if (control.kind === 'single_choice' || control.kind === 'multi_choice') return <fieldset key={control.key} className="dic-fieldset" disabled={blocked}>
        <legend>{control.label}{!control.required && <span className="dic-optional">Optional</span>}</legend>
        <div className="dic-choices">{control.options.map(option => {
          const multiple = control.kind === 'multi_choice', selected = multiple ? Array.isArray(value) && value.includes(option.value) : value === option.value;
          return <label key={option.value} className="dic-choice" data-selected={selected}>
            <input type={multiple ? 'checkbox' : 'radio'} name={`${id}-${control.key}`} value={option.value} checked={selected} disabled={blocked} required={!multiple && control.required} onChange={event => {
              if (multiple) update(control.key, event.target.checked ? [...(Array.isArray(value) ? value : []), option.value] : (Array.isArray(value) ? value : []).filter(item => item !== option.value));
              else update(control.key, option.value);
            }}/>
            <span className="dic-choice-mark" aria-hidden="true">{selected ? '✓' : ''}</span><span>{option.label}</span>
          </label>;
        })}</div>
        {control.kind === 'multi_choice' && <p className="dic-help">Choose all that apply.</p>}
      </fieldset>;
      if (control.kind === 'confirm') return <fieldset key={control.key} className="dic-fieldset" disabled={blocked}>
        <legend>{control.label}{!control.required && <span className="dic-optional">Optional</span>}</legend>
        <div className="dic-choices">{[true, false].map(answer => <label key={String(answer)} className="dic-choice" data-selected={value === answer}><input type="radio" name={`${id}-${control.key}`} checked={value === answer} disabled={blocked} required={control.required} onChange={() => update(control.key, answer)}/><span className="dic-choice-mark" aria-hidden="true">{value === answer ? '✓' : ''}</span><span>{answer ? 'Yes' : 'No'}</span></label>)}</div>
      </fieldset>;
      return <div className="dic-field" key={control.key}>
        <label htmlFor={controlId}>{control.label}{!control.required && <span className="dic-optional">Optional</span>}</label>
        {control.kind === 'textarea' ? <textarea id={controlId} value={typeof value === 'string' ? value : ''} rows={3} maxLength={1200} disabled={blocked} required={control.required} onChange={event => update(control.key, event.target.value)}/> : <input id={controlId} type={control.kind === 'text' ? 'text' : control.kind} value={typeof value === 'number' || typeof value === 'string' ? value : ''} step={control.kind === 'number' ? 'any' : undefined} min={control.min ?? undefined} max={control.max ?? undefined} maxLength={control.kind === 'text' ? 1200 : undefined} disabled={blocked} required={control.required} onChange={event => update(control.key, event.target.value)}/>}
      </div>;
    })}</div>
    {(validation || error) && <p className="dic-error" role="alert">{validation || error}</p>}
    <footer className="dic-footer"><button type="submit" disabled={blocked}>{busy && <span className="dic-spinner" aria-hidden="true"/>}{busy ? 'Sending…' : interaction.submitLabel}<span aria-hidden="true">{busy ? '' : '→'}</span></button><span className="dic-help">You can also reply in chat.</span></footer>
  </form>;
}
