import React from 'react';
import { CheckCircle } from 'lucide-react';
import type { Person,Settlement } from '../types/types';

interface SettlementsProps {
  people: Record<string, Person>;
  expenses: any[];
  settlements: Settlement[];
  onSettle: (settlement: { from: string; to: string; amount: number }) => void;
}

export function Settlements({ people, expenses, settlements, onSettle }: SettlementsProps) {
  const calculateBalances = () => {
    const balances: Record<string, number> = {};
    Object.keys(people).forEach(id => {
      balances[id] = 0;
    });

    expenses.forEach(expense => {
      balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;
      expense.participants.forEach((personId: string) => {
        const share = (expense.amount * parseInt(expense.splits[personId]?.toString() || '0')) / 100;
        balances[personId] = (balances[personId] || 0) - share;
      });
    });

    settlements.forEach(settlement => {
      balances[settlement.from] = (balances[settlement.from] || 0) + settlement.amount;
      balances[settlement.to] = (balances[settlement.to] || 0) - settlement.amount;
    });

    return balances;
  };

  const simplifyDebts = () => {
    const balances = calculateBalances();
    const creditors: Array<{ id: string; amount: number }> = [];
    const debtors: Array<{ id: string; amount: number }> = [];

    Object.entries(balances).forEach(([personId, balance]) => {
      if (balance > 0.01) {
        creditors.push({ id: personId, amount: balance });
      } else if (balance < -0.01) {
        debtors.push({ id: personId, amount: -balance });
      }
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const result: Array<{ from: string; to: string; amount: number }> = [];
    let i = 0, j = 0;

    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];
      const amount = Math.min(creditor.amount, debtor.amount);

      if (amount > 0.01) {
        result.push({ from: debtor.id, to: creditor.id, amount });
      }

      creditor.amount -= amount;
      debtor.amount -= amount;

      if (creditor.amount < 0.01) i++;
      if (debtor.amount < 0.01) j++;
    }

    return result;
  };

  const currentSettlements = simplifyDebts();

  if (currentSettlements.length === 0 && settlements.length === 0) {
    return <p className="text-green-600 font-medium text-center py-4">✓ All settled up!</p>;
  }

  return (
    <div>
      {currentSettlements.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Pending</h3>
          {currentSettlements.map((settlement, idx) => (
            <div key={idx} className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <p className="text-gray-800">
                  <span className="font-semibold">{people[settlement.from]?.name || 'Unknown'}</span> owes{' '}
                  <span className="font-semibold">{people[settlement.to]?.name || 'Unknown'}</span>{' '}
                  <span className="font-bold text-purple-600">₹{settlement.amount.toFixed(2)}</span>
                </p>
                <button
                  onClick={() => onSettle(settlement)}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1 transition"
                >
                  <CheckCircle size={16} />
                  Settle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {settlements.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Settled Transactions</h3>
          {settlements.map((transaction) => (
            <div key={transaction.id} className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-800">
                    <span className="font-semibold">{people[transaction.from]?.name || 'Unknown'}</span> paid{' '}
                    <span className="font-semibold">{people[transaction.to]?.name || 'Unknown'}</span>{' '}
                    <span className="font-bold text-green-600">₹{transaction.amount.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(transaction.date).toLocaleString()}
                  </p>
                </div>
                <CheckCircle size={20} className="text-green-600" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}