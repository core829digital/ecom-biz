"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/fields";
import { handleize } from "@/lib/slug";
import { createStoreAction } from "./actions";

export function NewStoreForm(props: {
  rootDomain: string;
  defaultEmail: string;
  defaultLocale: string;
  countries: { code: string; name: string }[];
  currencies: string[];
  locales: { value: string; label: string }[];
  labels: Record<"name" | "slug" | "email" | "country" | "currency" | "locale" | "submit", string>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const { labels } = props;
  return (
    <ActionForm action={createStoreAction} className="space-y-4">
      <Input
        name="name"
        label={labels.name}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugTouched) setSlug(handleize(e.target.value).slice(0, 40));
        }}
        required
      />
      <Input
        name="slug"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        label={labels.slug}
        value={slug}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value.toLowerCase());
        }}
        hint={`${slug || "your-store"}.${props.rootDomain}`}
        required
      />
      <Input name="email" type="email" autoComplete="email" label={labels.email} defaultValue={props.defaultEmail} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="countryCode" label={labels.country} defaultValue="RO">
          {props.countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </Select>
        <Select name="currency" label={labels.currency} defaultValue="EUR">
          {props.currencies.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>
      <Select name="locale" label={labels.locale} defaultValue={props.defaultLocale}>
        {props.locales.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </Select>
      <SubmitButton className="w-full">{labels.submit}</SubmitButton>
    </ActionForm>
  );
}
