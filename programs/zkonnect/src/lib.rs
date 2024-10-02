#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use std::ops::DerefMut;

pub mod states;
pub use states::*;

pub mod zkonnect_utils;
pub use zkonnect_utils::*;

declare_id!("E8kA7XjYkKYbXVFm8BWr3NEpSZMKrotQhpf32YLg3mQ6");

#[program]
pub mod zkonnect {
    use super::*;

    #[allow(clippy::too_many_arguments)]
    pub fn create_event(
        ctx: Context<CreateEvent>,
        event_name: String,
        event_description: String,
        banner: String,
        nfturi: String,
        ticket_price: u64,
        total_tickets: u8,
        pay_sol: u8,
    ) -> Result<()> {
        ctx.accounts.create_event(
            &ctx.bumps,
            event_name,
            event_description,
            banner,
            nfturi,
            ticket_price,
            total_tickets,
            pay_sol,
        );
        Ok(())
    }

    pub fn pay_sol_for_ticket(ctx: Context<PaySolForTicket>) -> Result<()> {
        ctx.accounts.buy_ticket()?;
        Ok(())
    }

    pub fn pay_for_ticket(ctx: Context<PayForTicket>) -> Result<()> {
        ctx.accounts.buy_ticket()?;
        Ok(())
    }

    pub fn close_account(ctx: Context<CloseAccount>) -> Result<()> {
        let account = ctx.accounts.account.to_account_info();

        let dest_starting_lamports = ctx.accounts.receiver.lamports();

        **ctx.accounts.receiver.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        let mut data = account.try_borrow_mut_data()?;
        for byte in data.deref_mut().iter_mut() {
            *byte = 0;
        }

        Ok(())
    }
}
