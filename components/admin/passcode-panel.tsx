import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { MessageBox } from "@/components/ui/message-box";
import { Panel } from "@/components/ui/panel";

type PasscodePanelProps = {
  message: string;
  passcode: string;
  onPasscodeChange: (passcode: string) => void;
  onSubmit: () => void;
};

export function PasscodePanel({ message, onPasscodeChange, onSubmit, passcode }: PasscodePanelProps) {
  return (
    <Panel width="narrow">
      <Field label="パスコード">
        <TextInput
          type="password"
          value={passcode}
          onChange={(event) => onPasscodeChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSubmit();
            }
          }}
        />
      </Field>
      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="primary" onClick={onSubmit}>
          表示する
        </Button>
      </div>
      {message && <MessageBox className="mb-0 mt-4">{message}</MessageBox>}
    </Panel>
  );
}
