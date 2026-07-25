import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";

import { RegisterSchema } from "@/api/schemas";
import { Field, FormButton, FormError, fieldErrorsFrom } from "@/components/auth/fields";
import { Screen } from "@/components/chrome/Screen";
import { useAuth } from "@/hooks/useAuth";
import { color, space, type } from "@/lib/tokens";

export default function Signup() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const update = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setFormError(null);
    const parsed = RegisterSchema.safeParse({
      ...form,
      name: form.name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
    });
    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const issue of parsed.error.issues) flat[String(issue.path[0])] = issue.message;
      return setFieldErrors(flat);
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await register(parsed.data);
      router.replace("/home");
    } catch (e) {
      const inline = fieldErrorsFrom(e);
      if (Object.keys(inline).length) setFieldErrors(inline);
      else setFormError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Join Game Ground</Text>
          <Text style={styles.sub}>Find games, coaches and courts near you.</Text>

          <FormError error={formError} />
          <Field
            label="Name"
            value={form.name}
            onChangeText={update("name")}
            error={fieldErrors.name}
            autoComplete="name"
            placeholder="Your name"
          />
          <Field
            label="Username"
            value={form.username}
            onChangeText={update("username")}
            error={fieldErrors.username}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="lowercase_letters_only"
          />
          <Field
            label="Email"
            value={form.email}
            onChangeText={update("email")}
            error={fieldErrors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={form.password}
            onChangeText={update("password")}
            error={fieldErrors.password}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <FormButton title="Create account" onPress={submit} loading={busy} />

          <Text style={styles.footer}>
            Already playing?{" "}
            <Link href="/login" style={styles.footerLink}>
              Log in
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingVertical: space(8) },
  title: { ...type.title1, color: color.text, marginBottom: space(2) },
  sub: { ...type.body, color: color.dim, marginBottom: space(7) },
  footer: { ...type.body, color: color.dim, textAlign: "center", marginTop: space(8) },
  footerLink: { color: color.redLight, fontFamily: type.bodyStrong.fontFamily },
});
