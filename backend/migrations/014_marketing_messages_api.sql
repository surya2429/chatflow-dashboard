-- 014_marketing_messages_api.sql — marketing sends moved from Marketing Messages Lite (/mm_lite) to the
-- Marketing Messages API for WhatsApp (/marketing_messages). Cloud API stops accepting marketing messages
-- on 2027-10-13 (new accounts from 2027-04-13). Existing rows and the column default follow the rename.
ALTER TYPE message_channel RENAME VALUE 'mm_lite' TO 'mm_api';
