-- Rename vocabulary fields for Arabic-as-target-language semantics
ALTER TABLE "VocabularyItem" RENAME COLUMN "translationEn" TO "translation";
ALTER TABLE "VocabularyItem" RENAME COLUMN "exampleDe" TO "exampleTarget";
ALTER TABLE "VocabularyItem" RENAME COLUMN "exampleEn" TO "exampleTranslation";
