import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './input';
import { Label } from './label';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text...' },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="name@example.com" />
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="email-error">Email</Label>
      <Input
        type="email"
        id="email-error"
        placeholder="name@example.com"
        className="border-red-500 focus-visible:ring-red-500"
        aria-invalid="true"
      />
      <p className="text-sm text-red-500">Please enter a valid email address.</p>
    </div>
  ),
};

export const Disabled: Story = {
  args: { placeholder: 'Disabled input', disabled: true },
};
