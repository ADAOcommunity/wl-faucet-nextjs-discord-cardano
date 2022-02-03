export interface Utxo {
    tx_hash:      string;
    tx_index:     number;
    output_index: number;
    amount:       Amount[];
    block:        string;
    data_hash:    null;
}

export interface Amount {
    unit:     string;
    quantity: string;
}

export interface DiscordUserCookie {
    id:            string;
    username:      string;
    avatar:        string;
    discriminator: string;
    public_flags:  number;
    flags:         number;
    banner:        string;
    banner_color:  null;
    accent_color:  null;
    locale:        string;
    mfa_enabled:   boolean;
    premium_type:  number;
    iat:           number;
    exp:           number;
}

export interface UtxoRecord {
    id:     string
    used:   Date
    usedById: string
    txHash: string
    // used: boolean;
}

export interface WhitelistedUser {
    id:     string;
    claimed: boolean;
}

export interface IClaim {
    whitelisted: boolean,
    claimed: boolean
}

export interface ClaimRes {
    claim: IClaim,
    error: string
}