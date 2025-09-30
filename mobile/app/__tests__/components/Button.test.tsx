import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../../components/Button';

describe('Button Component', () => {
  it('renders correctly with title', () => {
    const { getByText } = render(<Button title="Test Button" onPress={() => {}} />);
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(<Button title="Test Button" onPress={mockOnPress} />);
    
    fireEvent.press(getByText('Test Button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders with different variants', () => {
    const { getByText: getPrimary } = render(
      <Button title="Primary" onPress={() => {}} variant="primary" />
    );
    const { getByText: getOutline } = render(
      <Button title="Outline" onPress={() => {}} variant="outline" />
    );
    const { getByText: getGhost } = render(
      <Button title="Ghost" onPress={() => {}} variant="ghost" />
    );

    expect(getPrimary('Primary')).toBeTruthy();
    expect(getOutline('Outline')).toBeTruthy();
    expect(getGhost('Ghost')).toBeTruthy();
  });

  it('renders with different sizes', () => {
    const { getByText: getSmall } = render(
      <Button title="Small" onPress={() => {}} size="small" />
    );
    const { getByText: getMedium } = render(
      <Button title="Medium" onPress={() => {}} size="medium" />
    );
    const { getByText: getLarge } = render(
      <Button title="Large" onPress={() => {}} size="large" />
    );

    expect(getSmall('Small')).toBeTruthy();
    expect(getMedium('Medium')).toBeTruthy();
    expect(getLarge('Large')).toBeTruthy();
  });

  it('disables button when disabled prop is true', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <Button title="Disabled Button" onPress={mockOnPress} disabled />
    );
    
    fireEvent.press(getByText('Disabled Button'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('shows loading state', () => {
    const { getByText } = render(
      <Button title="Loading Button" onPress={() => {}} loading />
    );
    
    expect(getByText('Loading...')).toBeTruthy();
  });

  it('applies custom styles', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByText } = render(
      <Button title="Custom Button" onPress={() => {}} style={customStyle} />
    );
    
    const button = getByText('Custom Button');
    expect(button).toBeTruthy();
  });
});
