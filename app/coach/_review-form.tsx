/**
 * Post-booking review form (M8). Server enforces eligibility — any 4xx renders inline,
 * server `error` verbatim (§16.4). Stars are tappable input here, not the static display.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fieldErrorsFrom } from "@/components/auth/fields";
import { Button, Input, Press, StarIcon } from "@/components/ds";
import { useSubmitReview } from "@/hooks/queries";
import * as haptics from "@/lib/haptics";
import { color, radius, space, type } from "@/lib/tokens";

export function ReviewForm({ coachId }: { coachId: string }) {
  const submit = useSubmitReview(coachId);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return <Text style={styles.thanks}>Thanks for your review!</Text>;

  const onSubmit = () => {
    setError(null);
    if (rating < 1) return setError("Pick a rating first");
    submit.mutate(
      { rating, body: body.trim() },
      {
        onSuccess: () => {
          haptics.success();
          setDone(true);
        },
        onError: (e) => {
          const inline = fieldErrorsFrom(e);
          setError(inline.body ?? inline.rating ?? (e as Error).message);
        },
      },
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Leave a review</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Press
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${n} stars`}
            scaleTo={0.9}
            onPress={() => {
              haptics.selection();
              setRating(n);
            }}
          >
            <StarIcon size={26} color={n <= rating ? color.gold : color.dim2} />
          </Press>
        ))}
      </View>
      <Input
        placeholder="How were the sessions? (optional)"
        value={body}
        onChangeText={setBody}
        multiline
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title="Submit review" onPress={onSubmit} loading={submit.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(2.5), backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, padding: space(3.5), marginBottom: space(2) },
  label: { ...type.label, color: color.dim },
  stars: { flexDirection: "row", gap: space(1.5) },
  error: { ...type.caption, color: color.redLight },
  thanks: { ...type.body, color: color.success, paddingVertical: space(2) },
});
