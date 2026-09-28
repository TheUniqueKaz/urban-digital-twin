import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthBoundary';
import type { Navigate } from '../shared/navigation';

type Customer = { id: string; name: string };
type Site = { id: string; customerId: string; name: string; digitalTwin: { id: string; name: string } };

export function CustomersPage({ navigate }: { navigate: Navigate }) {
  const { authenticatedFetch } = useAuth();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authenticatedFetch('/api/customers')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load customers.');
        setCustomers(await response.json() as Customer[]);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load customers.'));
  }, [authenticatedFetch]);

  return (
    <main>
      <h1>Customers</h1>
      {error && <p role="alert">{error}</p>}
      {customers?.length === 0 && <p>No customers available for this account</p>}
      <ul>
        {customers?.map((customer) => (
          <li key={customer.id}>
            <a href={`/customers/${customer.id}`} onClick={(event) => navigate(event, `/customers/${customer.id}`)}>
              {customer.name}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function CustomerPage({ customerId, navigate }: { customerId: string; navigate: Navigate }) {
  const { authenticatedFetch } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      authenticatedFetch(`/api/customers/${customerId}`),
      authenticatedFetch(`/api/customers/${customerId}/sites`),
    ]).then(async ([customerResponse, sitesResponse]) => {
      if (!customerResponse.ok || !sitesResponse.ok) throw new Error('Customer data is unavailable.');
      setCustomer(await customerResponse.json() as Customer);
      setSites(await sitesResponse.json() as Site[]);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Customer data is unavailable.'));
  }, [authenticatedFetch, customerId]);

  return (
    <main>
      <a href="/customers" onClick={(event) => navigate(event, '/customers')}>Customers</a>
      {error ? <p role="alert">{error}</p> : <h1>{customer?.name ?? 'Loading customer…'}</h1>}
      {customer && (
        <section>
          <h2>Sites</h2>
          <ul>
            {sites.map((site) => (
              <li key={site.id}>
                <strong>{site.name}</strong>{' '}
                <a
                  href={`/customers/${customerId}/digital-twins/${site.digitalTwin.id}`}
                  onClick={(event) => navigate(event, `/customers/${customerId}/digital-twins/${site.digitalTwin.id}`)}
                >
                  Open {site.digitalTwin.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
