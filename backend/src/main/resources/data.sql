INSERT INTO ping_message (id, text)
VALUES (1, 'kotoba backend is alive — from postgres')
    ON CONFLICT (id) DO NOTHING;