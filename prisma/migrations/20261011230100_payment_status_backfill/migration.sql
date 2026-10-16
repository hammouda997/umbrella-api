-- Safe after enum values are committed
UPDATE "PaymentRequest" SET status = 'VALIDE_FINANCE' WHERE status = 'APPROUVE';
