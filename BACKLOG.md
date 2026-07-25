# BACKLOG — Game Ground Mobile

Items live here until a written decision moves them into a milestone (see docs/DECISIONS.md). Nothing on this list enters a branch without that.

| Item | Target | Notes |
|---|---|---|
| Streaks + named achievements (Weekend Warrior, Night Owl, 100 Matches, Captain/Legend) + XP framing | v1.1 | Decision 6. Server: achievement definitions, award engine hooked into existing mutation paths, user_achievements table. Client: AchievementsRail unlock states + celebration per MOTION.md §5. |
| Social graph (friends, follows, friend-activity feed) | v1.1+ | Explicit v1 non-goal. "Play again" (teammates-based) covers the near need. |
| Coach dashboard on mobile | v1.1 | Await coach demand signals post-launch (product PRD open question 2). |
| Weather on Home hero | v1 toggle | Build-time flag exists in M9A client brief; enabling = one open-meteo call (no key). Decide before M9A client half. |
| AI recommendations screen (/api/ai/recommend) | v1.1+ | v1 non-goal until mobile usage justifies rate-limit spend. |
| Live Activities / Dynamic Island / home-screen widgets | v2 | iOS-native surface work; revisit after launch metrics. |
| Notification center (in-app grouped inbox) | v1.1 | v1 ships OS notifications + per-category toggles only (M12). |
| Voice search | v2 | Placeholder-level idea from design prompts; no v1 justification. |
| Sound design (subtle success sounds, mutable) | v2 | Haptics carry v1 feedback. |
| Play Integrity / App Attest on payment endpoints; certificate pinning | post-launch | S2 items — deliberately deferred (solo-maintainer outage risk). |
| Light theme | v2 decision | Kit is dark-native (product PRD 6.9). |
