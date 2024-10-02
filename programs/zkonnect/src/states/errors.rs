use anchor_lang::error_code;

#[error_code]
pub enum MyError {
    #[msg("Pay Sol not enabled")]
    PaySolNotEnabled,
    #[msg("Only SOL is accepted")]
    PayOnlySol,
    #[msg("All Tickets Sold out")]
    SoldOut,
}